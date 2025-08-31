# Budget Tracker Calculations Documentation

## Overview
This document explains all the calculations performed in the Budget Tracker application and how data flows from Excel sheets to final budget metrics.

## Data Sources

### 1. AE Sheet (Activities Estimates) - Budget Data
- **Purpose**: Contains all budgeted/estimated values for activities
- **Key Columns**:
  - Column B (index 1): Project ID
  - Column C (index 2): Project Description
  - Column F (index 5): Activity Code
  - Column G (index 6): Activity Description
  - Column K (index 10): Estimated Cost
  - Column L (index 11): Estimated Revenue
  - Column M (index 12): Estimated Hours
  - Column S (index 18): Activity Sequence Number

### 2. PT Sheet (Project Transactions) - Actual Data
- **Purpose**: Contains all actual transactions/charges
- **Key Columns**:
  - Column F (index 5): Activity Sequence Number
  - Column S (index 18): Internal Quantity (Actual Hours)
  - Column Y (index 24): Internal Amount (Actual Cost)
  - Column AI (index 34): Sales Amount (Actual Revenue)

### 3. P Sheet (Projects) - Project Master Data
- **Purpose**: Contains project metadata and status
- **Key Columns**:
  - Column A: Project ID
  - Column B: Project Name
  - Column J: Project Status

## Core Calculations

### 1. Data Aggregation
**PT Data Aggregation by Activity Sequence**
```javascript
For each transaction in PT:
  Group by Activity Sequence Number
  Sum Internal Quantity → Total Actual Hours
  Sum Internal Amount → Total Actual Cost
  Sum Sales Amount → Total Actual Revenue
```

### 2. Budget Remaining
**Formula**: `Remaining Budget = Budget Revenue - Actual Revenue`

**Explanation**: 
- Shows how much budget is left to spend
- Positive value = under budget
- Negative value = over budget

**Example**:
```
Budget Revenue: $10,000
Actual Revenue: $7,500
Remaining Budget: $10,000 - $7,500 = $2,500
```

### 3. Usage Percentages

#### Hours Used Percentage
**Formula**: `Hours Used % = (Actual Hours / Budget Hours) × 100`

**Example**:
```
Budget Hours: 100
Actual Hours: 75
Hours Used %: (75 / 100) × 100 = 75%
```

#### Cost Used Percentage
**Formula**: `Cost Used % = (Actual Cost / Budget Cost) × 100`

**Example**:
```
Budget Cost: $5,000
Actual Cost: $4,000
Cost Used %: ($4,000 / $5,000) × 100 = 80%
```

#### Revenue Used Percentage
**Formula**: `Revenue Used % = (Actual Revenue / Budget Revenue) × 100`

**Example**:
```
Budget Revenue: $10,000
Actual Revenue: $8,500
Revenue Used %: ($8,500 / $10,000) × 100 = 85%
```

### 4. Status Determination

The status of each activity is determined based on usage percentages:

```javascript
if (Revenue Used % > 100 OR Cost Used % > 100) {
  Status = "OVER BUDGET" (Red)
} else if (Revenue Used % > 80 OR Cost Used % > 80) {
  Status = "WARNING" (Yellow)
} else {
  Status = "ON TRACK" (Green)
}
```

### 5. T&E Fee Overrun
**Formula**: 
```javascript
if (Revenue Used % > 100) {
  Overrun = Actual Revenue - Budget Revenue
} else {
  Overrun = 0
}
```

**Purpose**: Shows the dollar amount by which the activity has exceeded its budget

## Data Flow Diagram

```
1. Excel Files Loaded
   ├── AE.xlsx (Budget Data)
   ├── PT.xlsx (Transaction Data)
   └── P.xlsx (Project Data)
        ↓
2. Data Processing
   ├── Parse headers from row 1
   ├── Extract data rows (starting row 2)
   └── Convert Excel values to JavaScript types
        ↓
3. PT Data Aggregation
   ├── Group transactions by Activity Seq
   ├── Sum hours, costs, and revenues
   └── Create aggregated totals per activity
        ↓
4. Join Budget and Actual Data
   ├── Match on Activity Sequence Number
   ├── AE provides budget values
   └── PT aggregates provide actual values
        ↓
5. Calculate Metrics
   ├── Remaining Budget
   ├── Usage Percentages
   ├── Status Indicators
   └── Overrun Amounts
        ↓
6. Display in UI
   ├── Summary Cards (totals)
   ├── Data Table (details)
   └── Visual indicators (colors, progress bars)
```

## Special Considerations

### Pivot Table Replacement
This application directly aggregates PT data instead of using Excel pivot tables:
- **Traditional**: PT data → Pivot Table → Lookups → Calculations
- **Our Approach**: PT data → Direct aggregation → Calculations

### Benefits of Direct Calculation
1. **Real-time updates** - No need to refresh pivot tables
2. **Flexibility** - Can add custom calculations easily
3. **Performance** - Faster than multiple XLOOKUP operations
4. **Transparency** - All calculations visible in code

### Edge Cases Handled
1. **Missing Activity Sequences**: Shows 0 for actuals if no transactions found
2. **Division by Zero**: Returns 0 for percentages when budget is 0
3. **Empty Cells**: Treats as 0 for numeric calculations
4. **Header Rows**: Automatically skips first row of data

## Validation Checks

### Data Quality Indicators
- Activities with budget but no actuals → May indicate not started
- Activities with actuals but no budget → May indicate unplanned work
- Usage > 100% → Requires attention
- Negative remaining budget → Over budget situation

### Common Issues and Solutions
1. **No projects showing**: Check if Activity Seq is in correct column (S for AE, F for PT)
2. **Wrong calculations**: Verify header row is being skipped
3. **Missing data**: Ensure all 4 Excel files are loaded
4. **Incorrect totals**: Check aggregation is grouping by Activity Seq correctly

## Excel Column Mapping Reference

### AE Sheet Columns
| Excel Column | Array Index | Data Type | Purpose |
|--------------|-------------|-----------|---------|
| A | 0 | Number | Row Number |
| B | 1 | String | Project |
| C | 2 | String | Project Description |
| D | 3 | String | Sub Project |
| E | 4 | String | Sub Project Description |
| F | 5 | String | Activity |
| G | 6 | String | Activity Description |
| K | 10 | Number | Estimated Cost |
| L | 11 | Number | Estimated Revenue |
| M | 12 | Number | Estimated Hours |
| S | 18 | Number | Activity Seq |

### PT Sheet Columns
| Excel Column | Array Index | Data Type | Purpose |
|--------------|-------------|-----------|---------|
| F | 5 | Number | Activity Seq |
| S | 18 | Number | Internal Quantity |
| Y | 24 | Number | Internal Amount |
| AI | 34 | Number | Sales Amount |

## Testing Calculations

### Sample Calculation
```
Activity Seq: 100000690
Budget: Hours=7.5, Cost=$1,995, Revenue=$2,230
Actual: Hours=16, Cost=$3,295.61, Revenue=$3,663.85

Calculations:
- Remaining = $2,230 - $3,663.85 = -$1,433.85 (OVER)
- Hours Used = (16/7.5) × 100 = 213%
- Cost Used = ($3,295.61/$1,995) × 100 = 165%
- Revenue Used = ($3,663.85/$2,230) × 100 = 164%
- Status = OVER BUDGET (>100%)
```

## Future Enhancements
1. Add cost rate calculations (Cost/Hour)
2. Include profit margin calculations
3. Add forecasting based on burn rate
4. Implement variance analysis
5. Add time-based trending