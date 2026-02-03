// data.js: Handles data storage and retrieval using localStorage. Modular for future backend expansion.

// Storage keys
const SERIES_CONFIG_KEY = 'zwiftSeriesConfig';
const RACE_DATA_KEY = 'zwiftRaceData';  // array of races, each with parsed results

// Save series config
function storeSeriesConfig(config) {
    localStorage.setItem(SERIES_CONFIG_KEY, JSON.stringify(config));
}

// Load series config
function loadSeriesConfig() {
    const config = localStorage.getItem(SERIES_CONFIG_KEY);
    return config ? JSON.parse(config) : null;
}

// Reset all data
function clearAllData() {
    localStorage.removeItem(SERIES_CONFIG_KEY);
    localStorage.removeItem(RACE_DATA_KEY);
    // Optional: clear aliases if you ever add them back
    // localStorage.removeItem(ALIAS_KEY);
}

// Save race results (parsed data for a specific race number)
function saveRaceResults(raceNumber, parsedData) {
    let races = loadAllRaces() || [];
    races[raceNumber - 1] = parsedData;  // 1-indexed
    localStorage.setItem(RACE_DATA_KEY, JSON.stringify(races));
}

// Load all races
function loadAllRaces() {
    const races = localStorage.getItem(RACE_DATA_KEY);
    return races ? JSON.parse(races) : [];
}

// Compute GC leaderboard (sum points or total time per rider/category)
function computeGC(config) {
    const races = loadAllRaces();
    const ridersGC = {};

    // Collect data
    races.forEach((race, raceIndex) => {
        if (!race) return;

        // Per category rider count for race-size points
        const catCounts = {};
        race.forEach(entry => {
            catCounts[entry.category] = (catCounts[entry.category] || 0) + 1;
        });

        race.forEach(entry => {
            const key = `${normalizeRiderName(entry.name)}_${entry.category}`;
            if (!ridersGC[key]) {
                ridersGC[key] = {
                    name: entry.name,
                    category: entry.category,
                    totalPoints: 0,
                    totalSeconds: 0,
                    racesCompleted: 0,
                    races: new Array(config.numRaces).fill(null)
                };
            }

            // Calculate points for this race
            let basePoints = 0;
            const pos = entry.position;

            if (config.pointsSystem === 'fixed100') {
                basePoints = Math.max(101 - pos, 0);
            } else if (config.pointsSystem === 'racesize') {
                const catSize = catCounts[entry.category] || 1;
                basePoints = Math.max(catSize - pos + 1, 0);
            } else if (config.pointsSystem === 'custom' && config.customPoints) {
                basePoints = config.customPoints[pos - 1] || 0;
            }

            // Add bonus if enabled and position qualifies
            let bonus = 0;
            if (config.enableBonus && config.bonusPoints && pos <= 3) {
                bonus = config.bonusPoints[pos - 1] || 0;
            }

            entry.points = basePoints + bonus;  // update entry for display

            ridersGC[key].totalPoints += entry.points;
            ridersGC[key].totalSeconds += parseFloat(entry.totalSeconds || 0);
            ridersGC[key].racesCompleted += 1;
            ridersGC[key].races[raceIndex] = {
                position: entry.position,
                points: entry.points,
                time: entry.time,
                gap: entry.gap,
                totalSeconds: entry.totalSeconds
            };
        });
    });

    // Group by category
    const byCategory = {};
    Object.values(ridersGC).forEach(rider => {
        const cat = rider.category;
        if (!byCategory[cat]) {
            byCategory[cat] = { complete: [], incomplete: [] };
        }

        if (rider.racesCompleted === config.numRaces) {
            byCategory[cat].complete.push(rider);
        } else {
            byCategory[cat].incomplete.push(rider);
        }
    });

    // Process complete riders (ranked GC)
    Object.keys(byCategory).forEach(cat => {
        let { complete, incomplete } = byCategory[cat];

        if (config.gcBasis === 'points') {
            // Points: everyone is "complete" in terms of eligibility
            complete = [...complete, ...incomplete];
            incomplete = [];
            complete.sort((a, b) => b.totalPoints - a.totalPoints);
        } else {
            // Time: only full participation counts
            complete.sort((a, b) => a.totalSeconds - b.totalSeconds);
            incomplete.sort((a, b) => a.name.localeCompare(b.name)); // alphabetical for display
        }

        // Assign positions for complete riders
        let pos = 1;
        for (let j = 0; j < complete.length; j++) {
            if (j > 0) {
                const prev = complete[j - 1];
                const curr = complete[j];
                if (config.gcBasis === 'points') {
                    if (curr.totalPoints === prev.totalPoints) {
                        curr.gcPosition = pos;
                        continue;
                    }
                } else {
                    if (Math.abs(curr.totalSeconds - prev.totalSeconds) < 0.01) {
                        curr.gcPosition = pos;
                        continue;
                    }
                }
            }
            pos = j + 1;
            complete[j].gcPosition = pos;
        }

        byCategory[cat] = { complete, incomplete };
    });

    return byCategory;
}
// Alias storage key
const ALIAS_KEY = 'zwiftRiderAliases';

// Save rider alias (normalized_alias -> canonical_name)
function saveRiderAlias(alias, canonical) {
    let aliases = loadRiderAliases() || {};
    aliases[normalizeRiderName(alias)] = canonical;
    localStorage.setItem(ALIAS_KEY, JSON.stringify(aliases));
}

// Load all aliases
function loadRiderAliases() {
    const aliases = localStorage.getItem(ALIAS_KEY);
    return aliases ? JSON.parse(aliases) : {};
}

// Apply alias during GC (use canonical name if alias matches)
function applyAlias(name) {
    const normalized = normalizeRiderName(name);
    const aliases = loadRiderAliases();
    return aliases[normalized] || name;
}