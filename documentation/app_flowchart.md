flowchart TD
  A[User clicks Buy Credits] --> B[Call API paymenttripay]
  B --> C[Tripay Checkout Session Created]
  C --> D[User completes Checkout]
  D --> E[Tripay sends Webhook to api webhooks tripay route]
  E --> F[Process Webhook]
  F --> G[Update user credits and transactions]

  subgraph AI Usage
    H[User submits Prompt] --> I{Sufficient credits}
    I -->|No| J[Return 402 Payment Required]
    I -->|Yes| K[Deduct credits]
    K --> L[Proxy request to AI Provider]
    L --> M[Stream AI Response]
    M --> N[Display Response to User]
  end