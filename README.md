# SAT-Cloud-Service ☁️

Cloud backend service for **SAT-CLI** providing secure API Gateway and AWS Lambda endpoints for AWS Bedrock remote access.

---

## 🏗️ Architecture

```
[ SAT-CLI ] 
     │
     ▼ (1. GET /credentials with Authorization header)
[ AWS API Gateway ]
     │
     ▼ (2. Invokes Handler)
[ AWS Lambda (credentials-handler) ]
     │
     ▼ (3. Reads Secret)
[ AWS Secrets Manager ] ──► Returns AWS Bedrock Key/Secret ──► [ SAT-CLI ]
```

---

## 📁 Repository Structure

```
.
├── src/
│   └── handlers/
│       └── credentials-handler.ts    # Lambda function handler
├── policies/
│   └── bedrock-invocation-policy.json # Least-privilege IAM policy template
├── template.yaml                      # AWS SAM deployment template
├── tsconfig.json                      # TypeScript configuration
└── package.json                       # Dependencies and build scripts
```

---

## 🚀 Setup & Local Build

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build
```

---

## 📦 Deployment via AWS SAM

```bash
# 1. Build SAM artifact
sam build

# 2. Deploy to AWS
sam deploy --guided
```

During `sam deploy`, provide:
* **SecretId**: Name of your secret in AWS Secrets Manager (e.g. `saturam-bedrock-credentials`).
* **ExpectedToken**: (Optional) Bearer token for client authentication.

---

## 🔐 IAM Bedrock Policy Configuration

Attach the IAM policy located in `policies/bedrock-invocation-policy.json` to the IAM User or Role whose credentials are stored in Secrets Manager.

This policy grants permissions for:
* `bedrock:InvokeModel`
* `bedrock:InvokeModelWithResponseStream`
* `bedrock:GetInferenceProfile` & `bedrock:ListInferenceProfiles`

---

## 🔗 Integrating with SAT-CLI

Once deployed, configure SAT-CLI using:

```bash
sat-cli init
```

Choose **AWS Bedrock (Remote)** and enter:
* **Remote API Gateway URL:** `https://<api-id>.execute-api.<region>.amazonaws.com/credentials`
* **Bearer Token:** (Optional matching token)
