;; CarbonProjectRegistry.clar
;; Core registry for forest preservation projects in the Verifiable Carbon Offsets system.
;; Handles project registration, metadata storage, unique identification, and basic management.
;; Ensures immutability where critical, while allowing controlled updates.
;; Integrates with other contracts via traits (e.g., for verification and token minting).
;; Uses unique project IDs derived from hashes to prevent duplicates.

;; Constants
(define-constant ERR-ALREADY-REGISTERED u100)
(define-constant ERR-UNAUTHORIZED u101)
(define-constant ERR-INVALID-PARAM u102)
(define-constant ERR-PROJECT-NOT-FOUND u103)
(define-constant ERR-INVALID-STATUS u104)
(define-constant ERR-MAX-TAGS-REACHED u105)
(define-constant ERR-PAUSED u106)
(define-constant ERR-INVALID-HASH u107)
(define-constant ERR-INVALID-OWNER u108)
(define-constant ERR-INVALID-METADATA-LENGTH u109)

(define-constant MAX-TITLE-LEN u100)
(define-constant MAX-DESCRIPTION-LEN u500)
(define-constant MAX-LOCATION-LEN u200)
(define-constant MAX-TAGS u10)
(define-constant MAX-TAG-LEN u50)

;; Data Variables
(define-data-var contract-owner principal tx-sender)
(define-data-var paused bool false)
(define-data-var project-counter uint u0)

;; Data Maps
(define-map projects
  { project-id: uint }
  {
    owner: principal,
    document-hash: (buff 32),  ;; SHA-256 hash of supporting documents
    title: (string-utf8 100),
    description: (string-utf8 500),
    location: (string-utf8 200),
    area-hectares: uint,
    estimated-co2-tons: uint,
    registered-at: uint,
    status: (string-ascii 20),  ;; e.g., "pending", "verified", "active", "retired"
    visibility: bool  ;; Public visibility
  }
)

(define-map project-tags
  { project-id: uint }
  { tags: (list 10 (string-utf8 50)) }
)

(define-map project-collaborators
  { project-id: uint, collaborator: principal }
  {
    role: (string-utf8 50),
    permissions: (list 5 (string-utf8 20)),  ;; e.g., ["update-metadata", "verify"]
    added-at: uint
  }
)

(define-map project-updates
  { project-id: uint, update-id: uint }
  {
    updater: principal,
    changes: (string-utf8 500),  ;; Description of changes
    timestamp: uint
  }
)

(define-map project-ownership-history
  { project-id: uint, transfer-id: uint }
  {
    from: principal,
    to: principal,
    timestamp: uint,
    reason: (string-utf8 200)
  }
)

;; Traits for Interoperability
;; Define a trait for verification contract to call back
(define-trait verification-trait
  (
    (verify-project (uint principal) (response bool uint))
  )
)

;; Private Functions
(define-private (is-contract-owner (caller principal))
  (is-eq caller (var-get contract-owner))
)

(define-private (generate-project-id)
  (begin
    (var-set project-counter (+ (var-get project-counter) u1))
    (var-get project-counter)
  )
)

(define-private (validate-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
    true
    false
  )
)

(define-private (validate-strings (title (string-utf8 100)) (desc (string-utf8 500)) (loc (string-utf8 200)))
  (and
    (<= (len title) MAX-TITLE-LEN)
    (<= (len desc) MAX-DESCRIPTION-LEN)
    (<= (len loc) MAX-LOCATION-LEN)
  )
)

(define-private (validate-numbers (area uint) (co2 uint))
  (and (> area u0) (> co2 u0))
)

;; Public Functions

;; Register a new project
(define-public (register-project 
  (document-hash (buff 32))
  (title (string-utf8 100))
  (description (string-utf8 500))
  (location (string-utf8 200))
  (area-hectares uint)
  (estimated-co2-tons uint)
  (initial-tags (list 10 (string-utf8 50)))
)
  (let
    (
      (caller tx-sender)
      (project-id (generate-project-id))
    )
    (if (var-get paused)
      (err ERR-PAUSED)
      (if (not (validate-hash document-hash))
        (err ERR-INVALID-HASH)
        (if (not (validate-strings title description location))
          (err ERR-INVALID-METADATA-LENGTH)
          (if (not (validate-numbers area-hectares estimated-co2-tons))
            (err ERR-INVALID-PARAM)
            (if (> (len initial-tags) MAX-TAGS)
              (err ERR-MAX-TAGS-REACHED)
              (begin
                (map-set projects
                  { project-id: project-id }
                  {
                    owner: caller,
                    document-hash: document-hash,
                    title: title,
                    description: description,
                    location: location,
                    area-hectares: area-hectares,
                    estimated-co2-tons: estimated-co2-tons,
                    registered-at: block-height,
                    status: "pending",
                    visibility: true
                  }
                )
                (map-set project-tags
                  { project-id: project-id }
                  { tags: initial-tags }
                )
                (print { event: "project-registered", project-id: project-id, owner: caller })
                (ok project-id)
              )
            )
          )
        )
      )
    )
  )
)

;; Update project metadata (owner only)
(define-public (update-project-metadata
  (project-id uint)
  (new-title (string-utf8 100))
  (new-description (string-utf8 500))
  (new-location (string-utf8 200))
  (changes-note (string-utf8 500))
)
  (let
    (
      (project (map-get? projects { project-id: project-id }))
      (caller tx-sender)
      (update-id (+ (len (map-get? project-updates { project-id: project-id })) u1))  ;; Simplified len check
    )
    (match project
      some-project
        (if (is-eq (get owner some-project) caller)
          (if (not (validate-strings new-title new-description new-location))
            (err ERR-INVALID-METADATA-LENGTH)
            (begin
              (map-set projects
                { project-id: project-id }
                (merge some-project {
                  title: new-title,
                  description: new-description,
                  location: new-location
                })
              )
              (map-set project-updates
                { project-id: project-id, update-id: update-id }
                {
                  updater: caller,
                  changes: changes-note,
                  timestamp: block-height
                }
              )
              (print { event: "metadata-updated", project-id: project-id })
              (ok true)
            )
          )
          (err ERR-UNAUTHORIZED)
        )
      (err ERR-PROJECT-NOT-FOUND)
    )
  )
)

;; Transfer project ownership
(define-public (transfer-ownership
  (project-id uint)
  (new-owner principal)
  (reason (string-utf8 200))
)
  (let
    (
      (project (map-get? projects { project-id: project-id }))
      (caller tx-sender)
      (transfer-id (+ (len (map-get? project-ownership-history { project-id: project-id })) u1))
    )
    (match project
      some-project
        (if (is-eq (get owner some-project) caller)
          (if (is-eq new-owner caller)
            (err ERR-INVALID-OWNER)
            (begin
              (map-set projects
                { project-id: project-id }
                (merge some-project { owner: new-owner })
              )
              (map-set project-ownership-history
                { project-id: project-id, transfer-id: transfer-id }
                {
                  from: caller,
                  to: new-owner,
                  timestamp: block-height,
                  reason: reason
                }
              )
              (print { event: "ownership-transferred", project-id: project-id, new-owner: new-owner })
              (ok true)
            )
          )
          (err ERR-UNAUTHORIZED)
        )
      (err ERR-PROJECT-NOT-FOUND)
    )
  )
)

;; Add collaborator
(define-public (add-collaborator
  (project-id uint)
  (collaborator principal)
  (role (string-utf8 50))
  (permissions (list 5 (string-utf8 20)))
)
  (let
    (
      (project (map-get? projects { project-id: project-id }))
      (caller tx-sender)
    )
    (match project
      some-project
        (if (is-eq (get owner some-project) caller)
          (if (is-some (map-get? project-collaborators { project-id: project-id, collaborator: collaborator }))
            (err ERR-ALREADY-REGISTERED)
            (begin
              (map-set project-collaborators
                { project-id: project-id, collaborator: collaborator }
                {
                  role: role,
                  permissions: permissions,
                  added-at: block-height
                }
              )
              (print { event: "collaborator-added", project-id: project-id, collaborator: collaborator })
              (ok true)
            )
          )
          (err ERR-UNAUTHORIZED)
        )
      (err ERR-PROJECT-NOT-FOUND)
    )
  )
)

;; Update project status (e.g., called by verification contract)
(define-public (update-project-status
  (project-id uint)
  (new-status (string-ascii 20))
  (caller principal)  ;; Could be verifier via trait
)
  (let
    (
      (project (map-get? projects { project-id: project-id }))
    )
    (match project
      some-project
        (if (or (is-eq (get owner some-project) caller) (has-permission project-id caller "update-status"))
          (if (is-eq new-status (get status some-project))
            (err ERR-INVALID-STATUS)
            (begin
              (map-set projects
                { project-id: project-id }
                (merge some-project { status: new-status })
              )
              (print { event: "status-updated", project-id: project-id, new-status: new-status })
              (ok true)
            )
          )
          (err ERR-UNAUTHORIZED)
        )
      (err ERR-PROJECT-NOT-FOUND)
    )
  )
)

;; Private helper for permissions
(define-private (has-permission (project-id uint) (user principal) (perm (string-utf8 20)))
  (let
    (
      (collab (map-get? project-collaborators { project-id: project-id, collaborator: user }))
    )
    (match collab
      some-collab
        (is-some (index-of (get permissions some-collab) perm))
      false
    )
  )
)

;; Toggle visibility
(define-public (toggle-visibility (project-id uint))
  (let
    (
      (project (map-get? projects { project-id: project-id }))
      (caller tx-sender)
    )
    (match project
      some-project
        (if (is-eq (get owner some-project) caller)
          (let
            (
              (new-vis (not (get visibility some-project)))
            )
            (map-set projects
              { project-id: project-id }
              (merge some-project { visibility: new-vis })
            )
            (print { event: "visibility-toggled", project-id: project-id, visibility: new-vis })
            (ok new-vis)
          )
          (err ERR-UNAUTHORIZED)
        )
      (err ERR-PROJECT-NOT-FOUND)
    )
  )
)

;; Admin functions
(define-public (pause-contract)
  (if (is-contract-owner tx-sender)
    (begin
      (var-set paused true)
      (ok true)
    )
    (err ERR-UNAUTHORIZED)
  )
)

(define-public (unpause-contract)
  (if (is-contract-owner tx-sender)
    (begin
      (var-set paused false)
      (ok true)
    )
    (err ERR-UNAUTHORIZED)
  )
)

(define-public (transfer-contract-ownership (new-owner principal))
  (if (is-contract-owner tx-sender)
    (begin
      (var-set contract-owner new-owner)
      (ok true)
    )
    (err ERR-UNAUTHORIZED)
  )
)

;; Read-Only Functions
(define-read-only (get-project-details (project-id uint))
  (map-get? projects { project-id: project-id })
)

(define-read-only (get-project-tags (project-id uint))
  (map-get? project-tags { project-id: project-id })
)

(define-read-only (get-collaborator (project-id uint) (collaborator principal))
  (map-get? project-collaborators { project-id: project-id, collaborator: collaborator })
)

(define-read-only (get-update-history (project-id uint) (update-id uint))
  (map-get? project-updates { project-id: project-id, update-id: update-id })
)

(define-read-only (get-ownership-history (project-id uint) (transfer-id uint))
  (map-get? project-ownership-history { project-id: project-id, transfer-id: transfer-id })
)

(define-read-only (is-paused)
  (var-get paused)
)

(define-read-only (get-contract-owner)
  (var-get contract-owner)
)

(define-read-only (get-project-counter)
  (var-get project-counter)
)