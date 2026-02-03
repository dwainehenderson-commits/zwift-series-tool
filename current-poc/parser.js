// parser.js: Handles parsing the pasted ZwiftPower results. Modularized for reuse.
// This is the core parsing logic from before, unchanged except for modularity.

function parseZwiftPowerPaste(text) {
    text = text.replace(/\r\n/g, '\n');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const rawRiders = [];
    let currentCategory = null;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Category line
        if (line.length === 1 && /^[A-G]$/.test(line)) {
            currentCategory = line;
            i++;
            continue;
        }

        if (!currentCategory) {
            i++;
            continue;
        }

        // Look for time line (contains :)
        if (line.includes(':')) {
            // Backtrack one line for name (the line before time is name)
            if (i > 0) {
                let nameLine = lines[i - 1].trim();

                // If the line before is junk (short/number), skip back further (up to 3)
                let back = 1;
                while (back <= 3 && i - back - 1 >= 0) {
                    const prev = lines[i - back - 1].trim();
                    if (prev.length < 8 || /^\d/.test(prev) || !/[a-zA-Z]{2,}/.test(prev)) {
                        back++;
                    } else {
                        nameLine = prev;
                        break;
                    }
                }

                // Validate name
                if (nameLine.length < 4 || !/[a-zA-Z]{2,}/.test(nameLine)) {
                    i++;
                    continue;
                }

                // Optional name cleaning (uncomment if needed)
                nameLine = nameLine
                    .replace(/^\d+\.?\s*/, '')  // remove "4. " or "44 "
            .replace(/\d{4,}$/, '')      // trailing numbers like 3935
                    .replace(/\s*\(.*?\)$/, '')  // (aged 14)
                    .replace(/\s*\[.*?\]/g, '')  // [ZWB]
                    .replace(/\s{2,}/g, ' ')
                    .trim();


                // Parse time + optional gap from current line
                let timeStr = line;
                let gapStr = '';

                if (line.includes('+')) {
                    const parts = line.split('+');
                    timeStr = parts[0].trim();
                    gapStr = '+' + parts[1].trim();
                }

                if (!/^\d{2}:\d{2}$/.test(timeStr)) {
                    i++;
                    continue;
                }

                rawRiders.push({
                    category: currentCategory,
                    name: nameLine,
                    time: timeStr,
                    gap: gapStr
                });

                // Skip the 3 power lines after time/gap
                i += 4;  // +1 for current time line, +3 power
                continue;
            }
        }

        i++;
    }

    // Group, sort, assign positions and points
    const byCategory = {};
    rawRiders.forEach(r => {
        if (!byCategory[r.category]) byCategory[r.category] = [];
        byCategory[r.category].push(r);
    });

    const results = [];
    Object.keys(byCategory).sort().forEach(cat => {
        const group = byCategory[cat];

        group.forEach(r => {
            const [m, s] = r.time.split(':').map(Number);
            let baseSec = m * 60 + s;

            let gapSec = 0;
            if (r.gap) {
                const g = r.gap.replace('+', '').replace('s', '').trim();
                if (g.includes(':')) {
                    const [gm, gs] = g.split(':').map(Number);
                    gapSec = (gm || 0) * 60 + (gs || 0);
                } else {
                    gapSec = parseFloat(g) || 0;
                }
            }
            r.totalSeconds = baseSec + gapSec;
        });

        group.sort((a, b) => a.totalSeconds - b.totalSeconds);

        let pos = 1;
        group.forEach((r, idx) => {
            if (idx > 0 && Math.abs(r.totalSeconds - group[idx - 1].totalSeconds) < 0.01) {
                r.position = pos;
            } else {
                pos = idx + 1;
                r.position = pos;
            }

            // assign points (based on series config, but default for now)
            let points = 0;
            if (r.position === 1) points = 50;
            else if (r.position === 2) points = 45;
            else if (r.position === 3) points = 40;
            else if (r.position <= 10) points = 41 - r.position;
            else if (r.position <= 20) points = 21 - r.position;
            else points = 1;

            results.push({
                category: cat,
                position: r.position,
                name: r.name,
                time: r.time,
                gap: r.gap || 'none',
                points: points,
                totalSeconds: r.totalSeconds.toFixed(3)
            });
        });
    });

    return results;
}