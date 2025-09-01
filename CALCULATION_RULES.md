# Grid Connection Dashboard - Calculation Rules & Business Logic

## 🚨 CRITICAL DEVELOPMENT RULES
1. **NEVER** make changes without explicit user request
2. **ALWAYS** preserve existing functionality
3. **VERIFY** data mappings before modifying calculations
4. **TEST** with actual Excel files before committing

## 📊 Data Architecture Overview

### Hybrid Data Model
```
┌─────────────────┐         ┌──────────────────┐
│  Excel Files    │  ──→    │  SQLite Cache    │
│  (Source Truth) │         │  (7-day expiry)  │
└─────────────────┘         └──────────────────┘
        ↓                            ↓
┌─────────────────────────────────────────────┐
│         In-Memory Global Data Cache         │
│    (Immediate access for all components)    │
└─────────────────────────────────────────────┘
```

### Data Sources & Sheet Mappings

| File | Sheet | Headers Row | Purpose | Key Columns |
|------|-------|------------|---------|-------------|
| **P.xlsx** | Projects | 1 | Project master data | A: Project ID, B: Name, C: Status, D: Budget |
| **PT.xlsx** | Transactions | 1 | Actual costs/hours | E: Activity Seq, S: Hours, Y: Cost, AH: Revenue |
| **AE.xlsx** | Estimates | 1 | Budget estimates | B: Project ID, S: Activity Seq, K: Est Cost |
| **Program_Management.xlsm** | Pipeline | **11** | Project pipeline | Custom columns per stage |
| **Program_Management.xlsm** | Program Quick View | **3** | RAG status | Program Name, RAG Status, Owner |
| **Program_Management.xlsm** | Vacation | 1 | Team availability | Employee, Date columns |

## 📋 Core Calculation Rules

### 1. Data Filtering Rules

#### 1.1 Project Status Filter
```javascript
VALID_STATUSES = ["Active", "In Progress", "On Hold", "Pending"]
EXCLUDE_STATUSES = ["Closed", "Cancelled", "Completed"]

// Apply to all calculations:
WHERE project.status IN VALID_STATUSES
```

#### 1.2 Activity Filter
```javascript
// Exclude closed activities
WHERE activity.status != "Closed"
  AND activity.end_date >= TODAY()
  AND activity.project_id IN (active_projects)
```

#### 1.3 Date Range Filter
```javascript
// Only include transactions within project dates
WHERE transaction.date >= project.start_date
  AND transaction.date <= MIN(project.end_date, TODAY())
```

### 2. Budget Calculations

#### 2.1 Project Budget
```javascript
// Hierarchy of budget fields (use first non-zero value)
Project_Budget = COALESCE(
  P.Budget_Column,
  P.Contracted_Amount,
  P.Approved_Budget,
  P.Total_Value,
  0
)
```

#### 2.2 Actual Spent
```javascript
// Sum internal costs from transactions
Actual_Spent = SUM(PT.Internal_Amount) 
WHERE PT.Project_ID = project.id
  AND PT.Status != "Cancelled"
  AND PT.Activity_Status != "Closed"

// Column mapping: PT.xlsx Column Y = Internal_Amount
```

#### 2.3 Budget Remaining
```javascript
Budget_Remaining = Project_Budget - Actual_Spent

// Visual indicators:
if (Budget_Remaining < 0) -> RED (Over budget)
if (Budget_Remaining < Project_Budget * 0.1) -> YELLOW (< 10% remaining)
else -> GREEN (Healthy)
```

#### 2.4 Budget Utilization
```javascript
Utilization_Percent = (Actual_Spent / Project_Budget) * 100

// Alert thresholds:
if (Utilization_Percent > 100) -> CRITICAL
if (Utilization_Percent > 90) -> WARNING
if (Utilization_Percent > 75) -> CAUTION
```

### 3. Revenue Calculations

#### 3.1 T&E vs Fixed Revenue
```javascript
// T&E (Time & Expenses) Revenue
T&E_Revenue = SUM(PT.Sales_Amount)
WHERE PT.Revenue_Type IN ('T&E', 'Time and Expenses', 'Hourly')

// Fixed Price Revenue
Fixed_Revenue = SUM(PT.Sales_Amount)
WHERE PT.Revenue_Type IN ('Fixed', 'Fixed Price', 'Lump Sum')

// Revenue Mix
T&E_Percentage = (T&E_Revenue / Total_Revenue) * 100
Fixed_Percentage = (Fixed_Revenue / Total_Revenue) * 100
```

#### 3.2 Revenue by Activity
```javascript
Activity_Revenue = SUM(PT.Sales_Amount)
GROUP BY PT.Activity_Seq
ORDER BY Activity_Revenue DESC

// Link to budget: Column AH in PT.xlsx = Sales_Amount
```

### 4. Hours Tracking

#### 4.1 Total Hours
```javascript
Total_Hours = SUM(PT.Internal_Quantity)
WHERE PT.Unit_Type = 'Hours'

// Column mapping: PT.xlsx Column S = Internal_Quantity
```

#### 4.2 Hours by Employee
```javascript
Employee_Hours = SUM(PT.Internal_Quantity)
GROUP BY PT.Employee_ID
WHERE PT.Transaction_Date >= date_range_start
  AND PT.Transaction_Date <= date_range_end
```

#### 4.3 Efficiency Metrics
```javascript
// Revenue per hour
Revenue_Per_Hour = Total_Revenue / Total_Hours

// Cost per hour
Cost_Per_Hour = Total_Cost / Total_Hours

// Margin per hour
Margin_Per_Hour = Revenue_Per_Hour - Cost_Per_Hour
```

### 5. Pivot Table Calculations

#### 5.1 PT Transactions by Activity
```javascript
PIVOT_TABLE = {
  rows: Activity_Seq,
  values: {
    Hours: SUM(Internal_Quantity),
    Cost: SUM(Internal_Amount),
    Revenue: SUM(Sales_Amount),
    Count: COUNT(*)
  },
  filter: Status != "Closed",
  sort: Revenue DESC,
  limit: 5 // Show only top 5 in Settings view
}
```

#### 5.2 Budget vs Actual Pivot
```javascript
BUDGET_PIVOT = {
  rows: Project_ID,
  columns: {
    Budget: FROM AE.xlsx,
    Actual: FROM PT.xlsx,
    Variance: Budget - Actual,
    Variance_%: ((Budget - Actual) / Budget) * 100
  },
  highlight: Variance_% < -10 // Over budget by 10%
}
```

### 6. Pipeline Stage Calculations

#### 6.1 Pipeline Value
```javascript
// Note: Pipeline headers are in row 11, not row 1
Pipeline_Value_By_Stage = SUM(Project_Value)
GROUP BY Pipeline_Stage
WHERE Pipeline_Stage IN ('Opportunity', 'Proposal', 'Negotiation', 'Won')
```

#### 6.2 Conversion Rates
```javascript
Stage_Conversion = {
  Opportunity_to_Proposal: COUNT(Proposal) / COUNT(Opportunity),
  Proposal_to_Negotiation: COUNT(Negotiation) / COUNT(Proposal),
  Negotiation_to_Won: COUNT(Won) / COUNT(Negotiation)
}
```

### 7. Alert Thresholds

#### 7.1 Budget Alerts
```javascript
ALERT_CONDITIONS = [
  {
    level: 'CRITICAL',
    condition: Actual_Spent > Project_Budget,
    message: 'Project over budget'
  },
  {
    level: 'WARNING',
    condition: Utilization_Percent > 90,
    message: 'Budget 90% consumed'
  },
  {
    level: 'CAUTION',
    condition: Burn_Rate > Expected_Rate * 1.2,
    message: 'Burn rate 20% above expected'
  }
]
```

#### 7.2 Activity Alerts
```javascript
Activity_Alert = {
  condition: Activity_Actual > Activity_Budget * 0.9,
  highlight: true,
  color: '#FEE2E2', // Light red background
  icon: '⚠️'
}
```

## 🔄 Caching Strategy

### Cache Expiry Rules
```sql
-- Data cache expires after 7 days (weekly refresh)
expires_at = datetime('now', '+7 days')

-- Pivot cache expires with data cache
pivot_expires = data_cache.expires_at

-- Force refresh clears all caches
ON force_refresh: DELETE FROM data_cache, pivot_cache
```

### Cache Validation
```javascript
is_cache_valid = (
  cache_exists &&
  cache.expires_at > NOW() &&
  cache.source_files_match(current_files)
)

if (!is_cache_valid) {
  reload_from_excel()
  update_cache()
}
```

## 📐 Special Calculation Cases

### RAG Status (Red/Amber/Green)
```javascript
// From Program Quick View sheet (row 3 headers)
RAG_Score = {
  'Green': 3,  // On track
  'Amber': 2,  // At risk
  'Red': 1     // Critical
}

Overall_RAG = MODE(all_project_rags) // Most common status
```

### Vacation Planning
```javascript
// Calculate team availability
Available_Resources = Total_Team_Members - On_Vacation
Availability_Percent = (Available_Resources / Total_Team_Members) * 100

// Conflict detection
Conflict = COUNT(critical_roles) WHERE all_members_on_vacation
```

## ⚠️ Known Edge Cases

1. **Pipeline Headers**: Always in row 11, not row 1
2. **Program Sheet**: Must use "Program Quick View" not "Program"
3. **Revenue Column**: Column AH (not AI) contains sales amount
4. **Activity Seq**: Key field linking PT and AE data
5. **Date Formats**: Excel serial dates need conversion
6. **Empty Budgets**: Check multiple columns for budget values
7. **Closed Projects**: Must be excluded from all calculations

## 🧪 Testing Checklist

Before deploying calculation changes:
- [ ] Test with projects having $0 budget
- [ ] Test with closed/cancelled projects excluded
- [ ] Test with future-dated transactions
- [ ] Test with missing Activity Seq links
- [ ] Verify pivot table 5-row limit in Settings
- [ ] Confirm cache expiry after 7 days
- [ ] Test force reload clears and reloads
- [ ] Verify all column mappings correct

---
*Last Updated: January 2025*
*Version: 2.0 - SQL Integration*