# Hospital Service

Lightweight external demo service for hospital record lookup.

- Port: `3002`
- Endpoint: `POST /api/hospital/records/match`
- Data source: shared MySQL table `hospital_records`

The insurance backend oracle listens for on-chain verification requests,
calls this service to find a matching medical record, stores a
`pending_manual` verification row, then waits for a hospital user to confirm
the verdict from the insurance app portal.
