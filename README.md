# 🌳 Blockchain Registry for Verifiable Carbon Offsets

Welcome to a revolutionary platform that tackles climate change by creating a transparent, blockchain-based registry for carbon offsets! This project tokenizes forest preservation initiatives as verifiable carbon credits on the Stacks blockchain, enabling global trading while preventing fraud, double-counting, and greenwashing. Using Clarity smart contracts, we ensure immutable records of project data, verification, and transactions to foster trust in the carbon market.

## ✨ Features

🌍 Register forest preservation projects with detailed metrics (e.g., area protected, estimated CO2 sequestration)
✅ Multi-step verification by certified auditors to confirm project legitimacy
💰 Tokenize verified projects into fungible carbon credit tokens (SIP-10 compliant)
📈 Global marketplace for trading carbon credits securely
🔥 Retire tokens permanently when offsets are claimed by buyers (e.g., companies offsetting emissions)
📊 Real-time oracle feeds for updating project impact data (e.g., satellite-verified forest health)
🗳️ Governance mechanisms for community-driven decisions on standards and upgrades
🚫 Anti-fraud measures like unique project hashes and duplicate prevention
🔍 Queryable registry for public transparency and reporting

## 🛠 How It Works

**For Project Owners (e.g., NGOs or Governments)**

- Submit project details including location, size, and projected carbon sequestration via the registry contract.
- Generate a unique hash of supporting documents (e.g., satellite images, legal deeds).
- Call `register-project` with the hash, metadata, and initial estimates.
- Await verification: Certified auditors review and approve via the verification contract.

Once verified, tokens are minted proportionally to the project's carbon impact.

**For Auditors/Verifiers**

- Register as a verifier through the management contract (requires governance approval).
- Use `verify-project` to submit on-chain attestations, including oracle data for real-world validation.
- Update project status with ongoing monitoring data to adjust token supply if needed.

**For Buyers/Traders (e.g., Corporations or Individuals)**

- Browse verified projects and purchase carbon tokens on the marketplace.
- Call `buy-tokens` or `sell-tokens` to trade securely with built-in escrow.
- To claim offsets, use `retire-tokens` to burn them, generating an immutable proof of offset.

**For Everyone**

- Query project details, token balances, or trade history using read-only functions.
- Participate in governance votes to propose changes, like adding new oracle sources.

This setup solves real-world issues in the carbon offset market by leveraging blockchain for transparency, reducing intermediaries, and enabling borderless trading—ultimately accelerating forest preservation efforts worldwide.

## 📂 Smart Contracts

This project is built with 8 Clarity smart contracts on the Stacks blockchain for modularity and security:

1. **CarbonProjectRegistry.clar**: Handles registration of new forest projects, storing metadata, hashes, and initial estimates. Prevents duplicates via unique IDs.
2. **VerifierManagement.clar**: Manages a whitelist of certified auditors, including registration, revocation, and permission checks via governance.
3. **ProjectVerification.clar**: Coordinates the verification workflow, allowing auditors to submit approvals and link to oracle data.
4. **CarbonToken.clar**: Implements a SIP-10 fungible token standard for carbon credits, with minting logic tied to verified sequestration metrics.
5. **Marketplace.clar**: A decentralized exchange for listing, buying, and selling carbon tokens with automated matching and escrow.
6. **OffsetRetirement.clar**: Enables permanent retirement (burning) of tokens, emitting events for proof-of-offset certificates.
7. **Oracle.clar**: Integrates external data feeds (e.g., for CO2 calculations or forest monitoring) to update project impacts dynamically.
8. **Governance.clar**: A DAO-style contract for token holders to vote on proposals, such as parameter changes or verifier additions.

Each contract is designed to interact seamlessly, with traits for composability. Deploy them on Stacks testnet for testing!