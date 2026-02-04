# Zwift Series Tracker - Basic Manager Guide

This is a simple local web app for running Zwift race series. Everything runs in your browser — no account or internet needed to use it (data stays on your computer).

## Quick Start

1. **Open the app**

2. **Set up your series** (only once)
    - Series name (e.g. "My Wednesday Worlds")
    - Number of races (e.g. 5)
    - Points system:
        - Fixed descending (1st = 100, then 99, 98...)
        - Race-size descending (1st gets points = number of riders in that race, then down)
        - Custom (type comma-separated points for positions 1–20)
    - Optional bonus: Check box + enter 3 numbers (e.g. 10,7,5 for 1st/2nd/3rd)
    - GC type: Points (sum) or Time (total time, only full participants ranked)
    - Click **Save Series Config**

   → Setup disappears, race entry screen appears.

3. **Enter race results**
    - Pick race number (auto-selects next unsaved race)
    - Copy-paste full ZwiftPower results text
    - Click **Parse and Save Race Results**

   Two check steps:

    - **Verify Parsed Data**  
      Table shows riders. Edit **names** if wrong.  
      Click **Confirm & Proceed**.

    - **Name Matches** (only if similar names found)  
      Suggestions appear (e.g. "dwaine h Team" → "Dwaine Henderson").  
      Check boxes to approve.  
      Click **Save Race** (or **Save with Approved Changes** if suggestions).

   → Race saved. Leaderboard updates.

4. **View leaderboard**
    - Tabs at top for each category
    - Click tab to see that category
    - Columns: GC Pos, Rider, Race 1, Race 2..., Total
    - Click headers to sort
    - Time GC: Only full participants ranked; others in "Incomplete" section below
    - Top shows which points system is used

5. **Clear everything** (start over)  
   Click **Clear All Data** (in setup or entry screen) → confirm → setup form returns.

## How Data Works

- **All data stays in your browser** (local storage) — private to your computer/browser.
- **Name matching**  
  App looks for similar names from earlier races (>82% match).  
  You decide whether to change name **for this race only** (helps GC combine points).  
  Exact matches ignored — no suggestions.
- **Points calculation**
    - Fixed: 100/99/98... or your custom list
    - Race-size: 1st gets # riders in category, then down
    - Bonus (if enabled): Extra points added to top 3 (shown as "+10pbp" in verification)
- **GC calculation**
    - Points: Sum of all points (missing race = 0)
    - Time: Sum of finish times (only riders who did every race ranked; others shown incomplete)
- **No data leaves your computer** unless you share/export later.

That's all — simple local tool for Zwift series. Enjoy! 🚴‍♂️