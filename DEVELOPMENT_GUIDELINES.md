# Development Guidelines

## Core Principles

### 1. NO UNAUTHORIZED CHANGES
- **NEVER** make changes that are not explicitly requested by the user
- **NEVER** "improve" or "optimize" code without being asked
- **NEVER** change UI layouts, styles, or functionality unless specifically requested
- **NEVER** remove or modify existing features unless instructed to do so

### 2. Data Sources and Integration
The application uses four Excel files that must be integrated:
- **P.xlsx** - Projects master data (budgets, project info)
- **PT.xlsx** - Project Transactions (hours, costs, activities)  
- **AE.xlsx** - All Employees (rates, employee info)
- **Program_Management.xlsm** - Pipeline tab (headers in row 11)

### 3. Feature Development Rules

#### When Adding New Features:
1. **ASK FIRST** if unclear about requirements
2. **PRESERVE** all existing functionality
3. **INTEGRATE** with existing code, don't replace it
4. **TEST** that existing features still work after changes

#### When Modifying Existing Features:
1. Only modify what is explicitly requested
2. Document why the change was made
3. Ensure backward compatibility where possible
4. Keep the original logic/structure unless change is requested

### 4. Excel File Handling

#### Pipeline Tab Special Rules:
- Headers are in **row 11** (index 10), not row 1
- Data starts from row 12 (index 11)
- All fields must be editable
- Changes must write back to Excel

#### Standard Excel Files (P, PT, AE):
- Headers are in row 1 (index 0)
- Data starts from row 2 (index 1)
- Primary keys link the files together
- Closed tasks/projects must be excluded from calculations

### 5. UI/UX Guidelines

#### DO NOT Change Without Request:
- Layout structure
- Color schemes
- Component hierarchy
- Navigation flow
- Button placements
- Font sizes or styles

#### ALWAYS Maintain:
- Existing tab structure
- Current functionality
- User workflows
- Data visualization methods

### 6. Code Organization

#### File Structure:
```
src/
  ├── PipelineManager.tsx      # Pipeline tab editor
  ├── EnhancedProjectDashboard.tsx  # Main dashboard with P, PT, AE integration
  ├── main.tsx                  # Entry point - DO NOT change component loading without request
  └── [other components]        # Leave unchanged unless modification requested
```

#### Component Responsibilities:
- **PipelineManager**: Handles Program_Management.xlsm Pipeline tab ONLY
- **EnhancedProjectDashboard**: Integrates P, PT, AE data with calculations
- Each component should handle its specific domain without interfering with others

### 7. Testing Checklist

Before committing any changes, verify:
- [ ] Only requested changes were made
- [ ] No existing features were broken
- [ ] Dashboard still shows P, PT, AE data correctly
- [ ] Pipeline tab reads headers from row 11
- [ ] Excel write-back functionality works
- [ ] All filters and calculations work as before
- [ ] UI layout remains unchanged (unless changes requested)

### 8. Communication Rules

#### Always Inform User:
- What specific changes are being made
- Why a change might affect other parts
- If a request might break existing functionality
- When clarification is needed

#### Never Assume:
- User wants "improvements" 
- Better practices should be implemented without asking
- UI needs "modernization"
- Code needs refactoring

### 9. Version Control

#### Commit Messages Should:
- Describe ONLY what was requested
- Not mention "improvements" or "optimizations" unless requested
- Be specific about changed functionality

### 10. Priority Order

When handling requests, prioritize in this order:
1. **Fix broken functionality** (if reported)
2. **Implement requested features** exactly as specified
3. **Maintain existing features** without modification
4. **Ask for clarification** if requirements unclear

## Summary

The golden rule: **DO EXACTLY WHAT IS REQUESTED - NOTHING MORE, NOTHING LESS**

If tempted to make an "improvement" - STOP and ASK first.