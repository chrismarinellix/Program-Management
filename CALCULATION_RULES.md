# Project Budget Calculation Rules

## IMPORTANT: Development Rules
**See DEVELOPMENT_GUIDELINES.md for coding standards**
- NO changes without explicit user request
- PRESERVE all existing functionality
- Pipeline headers are in row 11, not row 1

## Data Sources
- **P.xlsx** - Projects master data (budgets, project info)
- **PT.xlsx** - Project Transactions (hours, costs, activities)
- **AE.xlsx** - All Employees (rates, employee info)
- **Program_Management.xlsm** - Pipeline data (headers in row 11)

---

## 1. Data Filtering Rules

### 1.1 Project Status Filter
- **EXCLUDE** all projects where status = "Closed"
- **EXCLUDE** all projects where status = "Cancelled"
- **INCLUDE** only projects with status in: ["Active", "In Progress", "On Hold", "Pending"]

### 1.2 Task/Activity Filter
- **EXCLUDE** all tasks/activities marked as "Closed" in P.xlsx
- **EXCLUDE** all tasks/activities marked as "Closed" in AE.xlsx
- **EXCLUDE** transactions in PT.xlsx linked to closed tasks
- **INCLUDE** only open, active, or pending tasks

### 1.3 Date Range Filter
- **INCLUDE** only transactions within project start and end dates
- **EXCLUDE** future-dated transactions beyond current date

---

## 2. Budget Calculations

### 2.1 Project Budget
```
Project_Budget = P.xlsx[Budget_Column] for each project
NOTE: If Budget column is empty or 0, check for:
  - Contracted Amount column
  - Approved Budget column
  - Total Value column
```

### 2.2 Actual Spent
```
Actual_Spent = SUM(PT.xlsx[Total_Internal_Price]) 
WHERE Project_ID matches 
AND Task_Status != "Closed"
AND Employee_Status != "Closed" (from AE.xlsx)

Alternative if Total_Internal_Price is empty:
Actual_Spent = SUM(Internal_Price × Internal_Quantity)
OR
Actual_Spent = SUM(Sales_Amount) if internal price not available
```

### 2.3 Budget Remaining
```
Budget_Remaining = Project_Budget - Actual_Spent
```

### 2.4 Budget Utilization
```
Budget_Utilization_% = (Actual_Spent / Project_Budget) × 100
```

### 2.5 Budget Health Status
```
IF Budget_Utilization > 100% THEN "Over Budget" (RED)
IF Budget_Utilization > 90% THEN "At Risk" (YELLOW)
IF Budget_Utilization > 70% THEN "On Track" (BLUE)
IF Budget_Utilization <= 70% THEN "Healthy" (GREEN)
```

---

## 3. Hours & Labor Calculations

### 3.1 Total Hours Used
```
Total_Hours = SUM(PT.xlsx[Internal_Quantity])
WHERE Project_ID matches
AND Task_Status != "Closed"
```

### 3.2 Labor Cost
```
Labor_Cost = SUM(Hours × Employee_Hourly_Rate)
WHERE Employee_Hourly_Rate from AE.xlsx
```

### 3.3 Blended Rate
```
Blended_Rate = Total_Labor_Cost / Total_Hours
```

### 3.4 Cost Per Hour
```
Cost_Per_Hour = Actual_Spent / Total_Hours
```

---

## 4. Margin Calculations

### 4.1 Gross Margin
```
Gross_Margin = Sales_Amount - Total_Internal_Cost
WHERE Sales_Amount from PT.xlsx[Sales_Amount]
AND Total_Internal_Cost from PT.xlsx[Total_Internal_Price]
```

### 4.2 Margin Percentage
```
Margin_% = (Gross_Margin / Sales_Amount) × 100
```

### 4.3 Projected Margin at Completion
```
Projected_Margin = Project_Budget - Forecast_Final_Cost
WHERE Forecast_Final_Cost = Actual_Spent + Estimated_To_Complete
```

---

## 5. Performance Metrics

### 5.1 Burn Rate (Daily)
```
Daily_Burn_Rate = Actual_Spent / Days_Elapsed
WHERE Days_Elapsed = TODAY() - Project_Start_Date
```

### 5.2 Burn Rate (Weekly)
```
Weekly_Burn_Rate = Daily_Burn_Rate × 7
```

### 5.3 Days Remaining (Budget)
```
Days_Remaining = Budget_Remaining / Daily_Burn_Rate
```

### 5.4 Forecast Completion Date
```
Forecast_Completion = TODAY() + Days_Remaining
```

### 5.5 Forecast Final Cost
```
Forecast_Final_Cost = Actual_Spent + (Daily_Burn_Rate × Remaining_Project_Days)
WHERE Remaining_Project_Days = Project_End_Date - TODAY()
```

### 5.6 Cost Performance Index (CPI)
```
CPI = Earned_Value / Actual_Cost
WHERE Earned_Value = Budget × Percent_Complete
```

### 5.7 Schedule Performance Index (SPI)
```
SPI = Earned_Value / Planned_Value
WHERE Planned_Value = Budget × Planned_Percent_Complete
```

---

## 6. Subtask/Activity Calculations

### 6.1 Subtask Budget Allocation
```
Subtask_Budget = Project_Budget × Allocation_Percentage
OR
Subtask_Budget = Predefined_Budget from P.xlsx
```

### 6.2 Subtask Spent
```
Subtask_Spent = SUM(PT.xlsx[Total_Internal_Price])
WHERE Sub_Project_ID matches
AND Status != "Closed"
```

### 6.3 Subtask Hours
```
Subtask_Hours = SUM(PT.xlsx[Internal_Quantity])
WHERE Sub_Project_ID matches
AND Status != "Closed"
```

### 6.4 Subtask Completion
```
Subtask_Completion_% = (Subtask_Hours_Used / Subtask_Hours_Allocated) × 100
```

---

## 7. Employee/Resource Calculations

### 7.1 Employee Hours per Project
```
Employee_Project_Hours = SUM(PT.xlsx[Internal_Quantity])
WHERE Employee_ID matches
AND Project_ID matches
AND Task_Status != "Closed"
```

### 7.2 Employee Cost per Project
```
Employee_Project_Cost = Employee_Project_Hours × Employee_Rate
WHERE Employee_Rate from AE.xlsx[Hourly_Rate]
```

### 7.3 Employee Utilization
```
Employee_Utilization_% = (Billable_Hours / Total_Available_Hours) × 100
WHERE Billable_Hours = SUM(Hours where Invoiceable = "Yes")
```

### 7.4 Team Size
```
Team_Size = COUNT(DISTINCT Employee_ID)
WHERE Project_ID matches
AND Has_Transactions = TRUE
```

---

## 8. Variance Calculations

### 8.1 Budget Variance
```
Budget_Variance = Project_Budget - Actual_Spent
Budget_Variance_% = (Budget_Variance / Project_Budget) × 100
```

### 8.2 Schedule Variance
```
Schedule_Variance = Earned_Value - Planned_Value
Schedule_Variance_% = (Schedule_Variance / Planned_Value) × 100
```

### 8.3 Cost Variance
```
Cost_Variance = Earned_Value - Actual_Cost
Cost_Variance_% = (Cost_Variance / Earned_Value) × 100
```

---

## 9. Efficiency Metrics

### 9.1 Resource Efficiency
```
Resource_Efficiency = (Planned_Hours / Actual_Hours) × 100
```

### 9.2 Cost Efficiency
```
Cost_Efficiency = (Planned_Cost / Actual_Cost) × 100
```

### 9.3 Productivity Rate
```
Productivity_Rate = Output_Units / Input_Hours
WHERE Output_Units = Deliverables or Milestones completed
```

---

## 10. Forecasting Rules

### 10.1 Estimate to Complete (ETC)
```
ETC_Optimistic = (Budget - Actual_Spent) × CPI
ETC_Pessimistic = (Budget - Actual_Spent) / CPI
ETC_Most_Likely = (ETC_Optimistic + ETC_Pessimistic) / 2
```

### 10.2 Estimate at Completion (EAC)
```
EAC = Actual_Cost + ETC_Most_Likely
```

### 10.3 Variance at Completion (VAC)
```
VAC = Budget - EAC
VAC_% = (VAC / Budget) × 100
```

---

## 11. Special Rules

### 11.1 Non-Billable Work
- Track separately but include in total project cost
- Flag as "Non-Billable" in reports
- Include in margin calculations but not in revenue

### 11.2 Change Orders
- Add to original budget when approved
- Track separately for variance analysis
- Recalculate all percentages based on new budget

### 11.3 Multi-Currency Projects
- Convert all amounts to base currency (USD)
- Use exchange rate from transaction date
- Store original currency amount for reference

---

## 12. Activity & Description Tracking

### 12.1 Activity Identification
```
Activity_Key = Project_ID + Activity_Seq + Sub_Project
Activity_Description = PT.xlsx[Activity Description]
Sub_Project_Description = PT.xlsx[Sub Project Description]
Report_Code_Description = PT.xlsx[Report Code Description]
```

### 12.2 Activity Budget Allocation
```
DEFAULT: Activity_Budget = Project_Budget / Number_of_Activities
WEIGHTED: Activity_Budget = Project_Budget × Activity_Weight
WHERE Activity_Weight based on:
  - Planned hours
  - Historical complexity
  - Resource requirements
```

### 12.3 Activity Grouping
```
Group activities by:
  - Sub Project
  - Report Code
  - Activity Type
  - Phase/Milestone
```

---

## 13. Notes System

### 13.1 Note Structure
```
Note = {
  ID: Unique identifier (timestamp-based)
  Project_ID: Link to project
  Activity_ID: Optional link to specific activity
  Text: Note content
  Author: User who created note
  Timestamp: Date and time created
  Category: [general, budget, risk, progress]
}
```

### 13.2 Note Storage in AE.xlsx
```
New columns added to AE.xlsx:
  - Notes_History: JSON array of all notes
  - Last_Note: Most recent note text
  - Last_Note_Author: Who wrote last note
  - Last_Note_Date: When last note was added
  - Note_Category: Category of last note
```

### 13.3 Note Write-Back Rules
```
When adding note:
1. Read current AE.xlsx
2. Find or create Notes columns
3. Append note with timestamp
4. Save back to AE.xlsx
5. Log action for audit trail
```

---

## 14. Data Quality Rules

### 12.1 Required Fields
- Project must have: ID, Name, Budget, Start Date
- Transaction must have: Project_ID, Amount, Date
- Employee must have: ID, Name, Rate

### 12.2 Validation Rules
- Budget must be > 0
- Dates must be valid
- Employee rates must be > 0
- Hours must be >= 0

### 12.3 Default Values
- If Employee_Rate is missing, use default: $150/hour
- If Task_Budget is missing, use: Project_Budget × 0.1 (10%)
- If Status is missing, assume: "Active"

---

## Implementation Notes

1. **All calculations exclude closed tasks/projects** as per business rule
2. **Calculations run in real-time** when data is loaded
3. **Color coding** applied automatically based on thresholds
4. **Filters cascade** through all dependent calculations
5. **Historical data** preserved but excluded from active calculations
6. **Cache results** for performance on large datasets

---

## Update History
- Version 1.0 - Initial calculation rules
- Last Updated: [Current Date]
- Author: Project Management System

---