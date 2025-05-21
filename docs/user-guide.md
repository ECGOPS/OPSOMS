# ECG OMS User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Roles and Permissions](#user-roles-and-permissions)
4. [Fault Management](#fault-management)
5. [Analytics & Reporting](#analytics--reporting)
6. [System Configuration](#system-configuration)
7. [Troubleshooting](#troubleshooting)
8. [Security Guidelines](#security-guidelines)
9. [Best Practices](#best-practices)
10. [Advanced Features](#advanced-features)

## Introduction
ECG OMS (Outage Management System) is a comprehensive fault management system designed for power distribution networks. This guide will help you understand and effectively use the system's features to manage power outages, track fault resolution, and maintain system reliability.

### Key Features
- Real-time fault monitoring
- Automated outage tracking
- Performance analytics
- User role management
- Security controls
- Reporting tools

## Getting Started

### System Requirements
- Modern web browser (Chrome, Firefox, Edge)
- Internet connection
- Valid user credentials
- Required permissions

### Login Process
1. Navigate to the login page
2. Enter your credentials:
   - Username
   - Password
3. Click "Login"
4. If 2FA is enabled:
   - Enter the verification code
   - Click "Verify"

### Dashboard Overview
The dashboard provides a comprehensive view of system status:

#### Active Faults Panel
- Current active faults
- Fault severity levels
- Affected areas
- Time since occurrence

#### Recent Outages Panel
- Latest system outages
- Restoration status
- Affected customers
- Duration of outage

#### Key Performance Indicators
- System reliability metrics
- Response time statistics
- Customer impact analysis
- Regional performance

#### System Alerts
- Critical notifications
- Maintenance reminders
- Security alerts
- System updates

## User Roles and Permissions

### Available Roles

#### 1. System Administrator
**Responsibilities:**
- Full system access and control
- User account management
- System configuration
- Security settings
- Backup management

**Permissions:**
- Create/Edit/Delete users
- Configure system settings
- Manage security policies
- Access all features
- Generate system reports

#### 2. Regional Manager
**Responsibilities:**
- Regional oversight
- Team management
- Performance monitoring
- Resource allocation

**Permissions:**
- View regional data
- Manage regional users
- Generate regional reports
- Update fault status
- Access regional analytics

#### 3. Regional General Manager
**Responsibilities:**
- Regional oversight
- Team management
- Performance monitoring
- Resource allocation
- Strategic planning

**Permissions:**
- View regional data
- Manage regional users
- Generate regional reports
- Update fault status
- Access regional analytics
- Manage regional resources

#### 4. District Engineer
**Responsibilities:**
- District-level operations
- Fault response
- Field operations
- Customer communication

**Permissions:**
- Report faults
- Update fault status
- View district data
- Generate basic reports
- Access district analytics

#### 5. District Manager
**Responsibilities:**
- District-level operations
- Team leadership
- Resource management
- Performance monitoring
- Customer service oversight

**Permissions:**
- Report faults
- Update fault status
- View district data
- Generate basic reports
- Access district analytics
- Manage district resources

#### 6. Viewer
**Responsibilities:**
- Monitor system status
- View reports
- Track performance

**Permissions:**
- Read-only access
- View basic reports
- Access public data
- Monitor system status

## Fault Management

### Reporting a Fault

#### OP5 Fault Report
1. Navigate to "Faults" > "Report New Fault"
2. Select "OP5 Fault"
3. Fill in required information:
   - Region and District
   - Fault Location
   - Fault Type
   - Specific Fault Type
   - Occurrence Date/Time
   - Affected Population:
     * Rural
     * Urban
     * Metro
4. Add additional details:
   - Description
   - Priority Level
   - Initial Assessment
5. Submit the fault report

#### Control Outage Report
1. Navigate to "Faults" > "Report New Fault"
2. Select "Control Outage"
3. Fill in required information:
   - Region and District
   - Outage Type
   - Specific Outage Type
   - Occurrence Date/Time
   - Number of Customers Affected
4. Add additional details:
   - System Impact
   - Priority Level
   - Initial Assessment
5. Submit the outage report

### Updating Fault Status

#### Status Update Process
1. Navigate to "Faults" > "Active Faults"
2. Select the fault to update
3. Click "Update Status"
4. Enter update information:
   - Current Status
   - Restoration Date/Time
   - Repair Date/Time
   - Resolution Details
5. Save the update

#### Status Categories
- Active
- Under Investigation
- Being Repaired
- Resolved
- Closed

### Fault Categories

#### OP5 Faults
- Location-based faults
- Equipment failures
- Line issues
- Transformer problems
- Distribution issues

#### Control Outages
- System-wide issues
- Control failures
- Network problems
- Communication issues
- SCADA system faults

## Analytics & Reporting

### Viewing Analytics

#### Dashboard Analytics
1. Navigate to "Analytics"
2. Select date range
3. Choose region/district
4. View analytics dashboard:
   - Performance metrics
   - Trend analysis
   - Comparative data
   - Historical patterns

#### Custom Analytics
1. Click "Custom Analytics"
2. Select metrics
3. Choose time period
4. Apply filters
5. Generate report

### Key Metrics

#### MTTR (Mean Time To Repair)
- Average repair time
- Regional comparison
- Trend analysis
- Performance tracking
- Improvement areas

#### Reliability Indices
- SAIDI (System Average Interruption Duration Index)
- SAIFI (System Average Interruption Frequency Index)
- CAIDI (Customer Average Interruption Duration Index)
- Regional benchmarks
- Historical trends

### Generating Reports

#### Standard Reports
1. Navigate to "Reports"
2. Select report type:
   - Daily Summary
   - Weekly Analysis
   - Monthly Review
   - Quarterly Assessment
3. Choose parameters
4. Generate report

#### Custom Reports
1. Click "Create Custom Report"
2. Select metrics
3. Choose format
4. Set parameters
5. Generate report

## System Configuration

### User Management

#### Adding Users
1. Navigate to "Settings" > "Users"
2. Click "Add User"
3. Enter user details:
   - Username
   - Email
   - Role
   - Region/District
4. Set permissions
5. Save user

#### Managing Users
1. Select user
2. Choose action:
   - Edit details
   - Reset password
   - Change role
   - Deactivate account
3. Save changes

### Region/District Setup

#### Adding Regions
1. Navigate to "Settings" > "Locations"
2. Click "Add Region"
3. Enter region details
4. Save region

#### Adding Districts
1. Select region
2. Click "Add District"
3. Enter district details
4. Save district

## Troubleshooting

### Common Issues

#### Login Problems
1. Check credentials
2. Verify network connection
3. Clear browser cache
4. Reset password
5. Contact administrator

#### Report Generation
1. Check date range
2. Verify permissions
3. Clear browser cache
4. Check data availability
5. Contact support

#### Data Display
1. Refresh page
2. Check filters
3. Verify internet connection
4. Clear cache
5. Update browser

### Support
For additional support:
- Email: support@ecg-oms.com
- Phone: +1 (555) 123-4567
- Online Help Center: help.ecg-oms.com
- Emergency Support: 24/7 hotline

## Security Guidelines

### Password Management
1. **Password Requirements**
   - Minimum 12 characters
   - Must include uppercase and lowercase letters
   - Must include numbers
   - Must include special characters
   - Cannot reuse last 5 passwords
   - Must be changed every 90 days

2. **Password Best Practices**
   - Use unique passwords for each account
   - Never share passwords
   - Use a password manager
   - Enable two-factor authentication
   - Report suspicious activity

### Account Security
1. **Login Security**
   - Use secure networks
   - Log out after each session
   - Clear browser cache regularly
   - Enable session timeout
   - Monitor login activity

2. **Access Control**
   - Request minimum required access
   - Report unauthorized access
   - Review access permissions regularly
   - Follow principle of least privilege
   - Document access changes

### Data Protection
1. **Sensitive Data Handling**
   - Encrypt sensitive information
   - Use secure file transfer
   - Follow data classification guidelines
   - Report data breaches
   - Maintain data privacy

2. **System Usage**
   - Lock screen when away
   - Use approved software only
   - Regular system updates
   - Backup important data
   - Follow security policies

## Best Practices

### Daily Operations
1. Regular system checks
2. Data verification
3. Report generation
4. Status updates
5. Communication with team

### Data Management
1. Regular backups
2. Data validation
3. Clean data entry
4. Proper documentation
5. Regular audits

### Communication
1. Clear reporting
2. Team coordination
3. Customer updates
4. Stakeholder communication
5. Emergency protocols

## Advanced Features

### Automated Reporting
- Scheduled reports
- Custom templates
- Data export
- Integration options
- Automated distribution

### System Integration
- API access
- Data import/export
- Third-party tools
- Custom workflows
- Automated processes

### Mobile Access
- Mobile dashboard
- Field reporting
- Real-time updates
- Offline capabilities
- Location services 