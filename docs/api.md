# ECG OMS API Documentation

## Table of Contents
1. [Authentication](#authentication)
2. [Fault Management](#fault-management)
3. [Analytics](#analytics)
4. [User Management](#user-management)
5. [System Configuration](#system-configuration)

## Authentication

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}

Response:
{
  "token": "string",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "role": "string",
    "regionId": "string",
    "districtId": "string"
  }
}
```

### Logout
```http
POST /api/auth/logout
Authorization: Bearer {token}

Response:
{
  "success": true
}
```

## Fault Management

### Create OP5 Fault
```http
POST /api/faults/op5
Authorization: Bearer {token}
Content-Type: application/json

{
  "regionId": "string",
  "districtId": "string",
  "faultLocation": "string",
  "faultType": "string",
  "specificFaultType": "string",
  "occurrenceDate": "string",
  "affectedPopulation": {
    "rural": number,
    "urban": number,
    "metro": number
  }
}

Response:
{
  "success": true,
  "fault": {
    "id": "string",
    // ... full fault object
  }
}
```

### Create Control Outage
```http
POST /api/faults/control
Authorization: Bearer {token}
Content-Type: application/json

{
  "regionId": "string",
  "districtId": "string",
  "outageType": "string",
  "specificOutageType": "string",
  "occurrenceDate": "string",
  "customersAffected": number
}

Response:
{
  "success": true,
  "outage": {
    "id": "string",
    // ... full outage object
  }
}
```

### Update Fault Status
```http
PUT /api/faults/:id/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "active" | "resolved",
  "restorationDate": "string",
  "repairDate": "string"
}

Response:
{
  "success": true,
  "fault": {
    "id": "string",
    // ... updated fault object
  }
}
```

### Get Faults
```http
GET /api/faults
Authorization: Bearer {token}
Query Parameters:
  regionId?: string
  districtId?: string
  status?: string
  startDate?: string
  endDate?: string
  type?: "op5" | "control"

Response:
{
  "faults": [
    {
      "id": "string",
      // ... fault objects
    }
  ],
  "total": number,
  "page": number,
  "limit": number
}
```

## Analytics

### Get MTTR Analysis
```http
GET /api/analytics/mttr
Authorization: Bearer {token}
Query Parameters:
  regionId?: string
  districtId?: string
  startDate?: string
  endDate?: string

Response:
{
  "averageMTTR": number,
  "totalRepairTime": number,
  "faultsAnalyzed": number,
  "byRegion": [
    {
      "regionId": "string",
      "regionName": "string",
      "averageMTTR": number,
      "faultCount": number
    }
  ]
}
```

### Get Reliability Indices
```http
GET /api/analytics/reliability
Authorization: Bearer {token}
Query Parameters:
  regionId?: string
  districtId?: string
  startDate?: string
  endDate?: string

Response:
{
  "saidi": number,
  "saifi": number,
  "caidi": number,
  "byRegion": [
    {
      "regionId": "string",
      "regionName": "string",
      "saidi": number,
      "saifi": number,
      "caidi": number
    }
  ]
}
```

## User Management

### Create User
```http
POST /api/users
Authorization: Bearer {token}
Content-Type: application/json

{
  "username": "string",
  "email": "string",
  "password": "string",
  "role": "string",
  "regionId": "string",
  "districtId": "string"
}

Response:
{
  "success": true,
  "user": {
    "id": "string",
    // ... user object
  }
}
```

### Update User
```http
PUT /api/users/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "email": "string",
  "role": "string",
  "regionId": "string",
  "districtId": "string"
}

Response:
{
  "success": true,
  "user": {
    "id": "string",
    // ... updated user object
  }
}
```

## System Configuration

### Get Regions
```http
GET /api/regions
Authorization: Bearer {token}

Response:
{
  "regions": [
    {
      "id": "string",
      "name": "string",
      "districts": [
        {
          "id": "string",
          "name": "string"
        }
      ]
    }
  ]
}
```

### Create Region
```http
POST /api/regions
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "string"
}

Response:
{
  "success": true,
  "region": {
    "id": "string",
    "name": "string"
  }
}
```

### Create District
```http
POST /api/districts
Authorization: Bearer {token}
Content-Type: application/json

{
  "regionId": "string",
  "name": "string"
}

Response:
{
  "success": true,
  "district": {
    "id": "string",
    "name": "string",
    "regionId": "string"
  }
}
```

## Error Responses

All API endpoints may return the following error responses:

```http
400 Bad Request
{
  "error": "string",
  "message": "string"
}

401 Unauthorized
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}

403 Forbidden
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}

404 Not Found
{
  "error": "Not Found",
  "message": "Resource not found"
}

500 Internal Server Error
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
``` 