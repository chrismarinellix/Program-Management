# Data Source Mapping Guide

## Overview
The Pivot Tables now include data source indicators showing where each column's data comes from. This helps trace data back to the original Excel files and columns.

## Features

### 1. Column Headers with Source Indicators
Each column header now shows:
- The field name
- The source file (PT, AE, P)
- The column letter (E, AH, S, etc.)

Example: "Activity Seq (PT, E)" means this data comes from PT.xlsx, Column E

### 2. Interactive Tooltips
Hover over any column header to see:
- Full source file name (e.g., PT.xlsx)
- Exact column reference
- Option to edit the mapping (if enabled)

### 3. Edit Mappings Button
Click the "📊 Edit Mappings" button to:
- View all current data mappings
- Change the source file for any field
- Update column references
- Changes take effect immediately

## Data Source Files

### PT.xlsx (Project Transactions)
- **Column A**: Project ID
- **Column E**: Activity Seq
- **Column H**: Project Description
- **Column L**: Activity Description
- **Column S**: Hours (Internal Quantity)
- **Column Y**: Cost (Internal Amount)
- **Column AH**: Revenue (Sales Amount)

### AE.xlsx (Activity Estimates)
- **Column B**: Project ID
- **Column C**: Project Name
- **Column G**: Activity Description
- **Column K**: Budget Cost
- **Column L**: Budget Revenue
- **Column M**: Budget Hours
- **Column S**: Activity Seq

### P.xlsx (Projects)
- **Column A**: Project ID
- **Column B**: Project Name
- **Column C**: Status
- **Column D**: Budget

## How to Use

### Viewing Data Sources
1. Look at any column header to see its source (e.g., "Hours (PT, S)")
2. Hover over the header for more details
3. The format is: Field Name (Source File, Column Letter)

### Editing Mappings
1. Click "📊 Edit Mappings" button in the top-right
2. Find the field you want to change
3. Click "Edit" for that field
4. Select new source file from dropdown
5. Enter new column letter
6. Click "Save" to apply changes
7. Data will automatically refresh with new mappings

### Common Mapping Changes

#### If Activity Seq is in a different column:
1. Edit "Activity Seq" mapping
2. Change column from "E" to your actual column
3. Save and verify data loads correctly

#### If Revenue is in column AI instead of AH:
1. Edit "Revenue" mapping
2. Change column from "AH" to "AI"
3. Save to update

## Troubleshooting

### Data Not Loading After Mapping Change
- Verify the column letter is correct
- Check that the source file contains data in that column
- Ensure column contains the expected data type (numbers for amounts, text for descriptions)

### Mapping Editor Not Opening
- Check browser console for errors
- Refresh the page and try again
- Verify JavaScript is enabled

### Changes Not Persisting
- Mappings are stored in component state
- To make permanent, changes need to be saved to database
- Contact admin if mappings reset after page reload

## Benefits

1. **Transparency**: Always know where your data comes from
2. **Flexibility**: Adapt to different Excel file structures
3. **Debugging**: Quickly identify data source issues
4. **Documentation**: Built-in reference for data mappings
5. **Customization**: Adjust mappings without code changes

## Best Practices

1. Document any mapping changes in your team wiki
2. Test mappings with sample data before production use
3. Keep a backup of default mappings
4. Verify calculated fields after mapping changes
5. Use consistent column naming across Excel files

## Future Enhancements

Planned improvements include:
- Saving custom mappings to user preferences
- Import/export mapping configurations
- Validation rules for column data types
- Auto-detection of column mappings
- Mapping templates for common formats