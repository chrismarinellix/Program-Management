# Claude Request Safety Guide - Preventing Conflicts

## 🛡️ How to Make Safe Requests to Claude

### 1. Use These Magic Phrases to Trigger Analysis

Add these to your requests to make Claude analyze impacts:

```
"Before making changes, analyze what else might be affected"
"Check for conflicts before implementing"
"What are the side effects of this change?"
"Will this break anything else?"
"Show me the impact analysis first"
```

### 2. Request Templates for Safety

#### 🟢 SAFE: Feature Addition Template
```
"I want to add [feature].
1. First, check what components this might affect
2. List any potential conflicts
3. Then implement if safe"
```

#### 🟡 CAUTION: Modification Template
```
"I want to change [component/feature].
1. Show me what depends on this
2. List all files that import/use this
3. Warn me of any breaking changes
4. Then make the change with safety checks"
```

#### 🔴 DANGEROUS: Deletion Template
```
"I want to remove [feature].
1. Find all references to this
2. Show me what will break
3. Suggest safer alternatives
4. Only proceed if I confirm"
```

## 📋 Pre-Request Safety Checklist

Before asking Claude for changes, tell Claude to check:

### Data Flow Impact
- [ ] "Check if this affects data loading"
- [ ] "Check if this affects caching"
- [ ] "Check if this affects Excel processing"
- [ ] "Check if this affects SQL database"

### Component Dependencies
- [ ] "What components use this data?"
- [ ] "What views depend on this?"
- [ ] "Will navigation still work?"
- [ ] "Are there event listeners affected?"

### Business Logic
- [ ] "Check CALCULATION_RULES.md for conflicts"
- [ ] "Will calculations still be correct?"
- [ ] "Are pivot tables affected?"
- [ ] "Do column mappings need updating?"

## 🚨 Critical Areas - Always Request Impact Analysis

These areas are interconnected - ALWAYS ask for impact analysis:

### 1. Data Loading (GridConnectionDashboard)
```
"Analyze impact on data loading before changing"
```
**Connected to**: Everything
**Risk**: High - breaks entire app

### 2. Excel Column Mappings
```
"Check all components using this column before changing"
```
**Connected to**: All calculations
**Risk**: High - wrong data displayed

### 3. Cache System
```
"Show cache dependencies before modifying"
```
**Connected to**: Performance, data freshness
**Risk**: Medium - stale data issues

### 4. Global Data Cache
```
"List all components reading from globalDataCache"
```
**Connected to**: All views
**Risk**: High - components lose data

### 5. Event System
```
"Find all listeners for this event before changing"
```
**Connected to**: Component communication
**Risk**: Medium - broken updates

## 🎯 Safe Request Examples

### ✅ GOOD: Safe Request with Analysis
```
"I want to add a new column to the budget table.
Before implementing:
1. Check what components display budget data
2. Verify if this affects calculations
3. Check if Excel mappings need updates
4. List any SQL schema changes needed
Then implement with safety checks."
```

### ❌ BAD: Risky Request
```
"Add a new column to the budget table"
(No impact analysis requested)
```

### ✅ GOOD: Change with Dependency Check
```
"I want to change how revenue is calculated.
First:
1. Show me all places using revenue calculations
2. Check CALCULATION_RULES.md for the current formula
3. List components that display revenue
4. Warn about pivot table impacts
Then make the change safely."
```

## 🔍 How to Request Impact Analysis

### Pattern 1: Pre-Implementation Analysis
```
"Before implementing [change]:
- What files will be affected?
- What components depend on this?
- What could break?
- What tests should I run?"
```

### Pattern 2: Dependency Tree
```
"Show me the dependency tree for [component/feature]:
- What does it import?
- What imports it?
- What data does it use?
- What events does it listen to/emit?"
```

### Pattern 3: Risk Assessment
```
"Rate the risk of [change]:
- Low/Medium/High risk?
- What's the worst case scenario?
- How can we mitigate risks?
- Should we make a backup first?"
```

## 🤖 Claude Response Patterns to Expect

When you request safety analysis, Claude should respond with:

### 1. Impact Summary
```
IMPACT ANALYSIS for [your request]:
✅ Safe to proceed:
  - [list of safe aspects]
⚠️ Caution needed:
  - [list of concerns]
❌ Risks identified:
  - [list of breaking changes]
```

### 2. Affected Files List
```
Files that will be affected:
- Direct changes:
  - File1.tsx (modified)
  - File2.ts (modified)
- Indirect impacts:
  - File3.tsx (imports changed component)
  - File4.ts (uses modified data)
```

### 3. Testing Requirements
```
After this change, test:
1. Data still loads correctly
2. Calculations remain accurate
3. Force reload still works
4. Cache persistence works
5. All views display data
```

## 💡 Smart Questions to Always Ask

### Before Adding Features
1. "Where should this feature live in the component hierarchy?"
2. "Does similar functionality already exist?"
3. "What data sources will this need?"
4. "Should this be cached?"

### Before Modifying
1. "Show me what currently uses this"
2. "What's the original purpose of this code?"
3. "Are there comments explaining why it's done this way?"
4. "What edge cases does this handle?"

### Before Deleting
1. "Find all references to this first"
2. "Is this used by any calculations?"
3. "Check if any components import this"
4. "Is there a safer way to deprecate this?"

## 🛠️ Safety Commands for Claude

### Command: Analyze First
```
"ANALYZE FIRST: [your change request]"
```
Claude will analyze before implementing

### Command: Dry Run
```
"DRY RUN: Show me what would change if [request]"
```
Claude shows changes without making them

### Command: Safety Check
```
"SAFETY CHECK: Is it safe to [request]?"
```
Claude evaluates risk level

### Command: Find Dependencies
```
"FIND DEPS: What depends on [component/feature]?"
```
Claude lists all dependencies

## 📊 Risk Matrix

| Change Type | Risk Level | Required Checks |
|------------|------------|-----------------|
| Add new view | Low | Component hierarchy |
| Modify calculation | High | All displays, CALCULATION_RULES.md |
| Change data structure | Critical | Everything |
| Update styling | Low | Component only |
| Modify Excel processing | Critical | Data flow, all views |
| Change caching | High | Performance, data freshness |
| Add button/UI element | Low | Parent component |
| Modify navigation | Medium | All views, settings |
| Change global state | Critical | All components |
| Update SQL schema | High | Database migration needed |

## 🔒 Backup Before Risk

Always request backup for high-risk changes:

```
"This seems high risk. Please:
1. Show me what to backup first
2. How to restore if something breaks
3. Then proceed with caution"
```

## 📝 Change Log Request

For tracking what was modified:

```
"After making this change, provide:
1. List of all files modified
2. Summary of what changed
3. Any new dependencies added
4. Testing checklist
5. Rollback instructions"
```

## 🚀 Progressive Implementation

For complex changes, request step-by-step:

```
"Let's implement this in stages:
Stage 1: Show impact analysis
Stage 2: Make minimal change
Stage 3: Test it works
Stage 4: Add full functionality
Stage 5: Update documentation"
```

## ⚡ Quick Safety Phrases

Just add these to any request:

- "Check for conflicts first"
- "Analyze impact before changing"
- "What could break?"
- "Is this safe?"
- "Show dependencies first"
- "Test requirements?"
- "Backup needed?"
- "Can this be rolled back?"

---

## 🎯 GOLDEN RULE

**When in doubt, ask:**
```
"Is this safe to do? What should I check first?"
```

Claude will analyze and warn you before making any risky changes.

---
*Remember: It's always better to ask for analysis first than to fix breaks later!*