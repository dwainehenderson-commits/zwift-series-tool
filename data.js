// data.js: Handles data storage and retrieval using localStorage. Modular for future backend expansion.

// Storage keys
const SERIES_CONFIG_KEY = 'zwiftSeriesConfig';
const RACE_DATA_KEY = 'zwiftRaceData';  // array of races, each with parsed results

// Save series config
function storeSeriesConfig(config) {
    localStorage.setItem(SERIES_CONFIG_KEY, JSON.stringify(config));
}

// test edit
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
    // NEW: For team mode
    const teamsGC = {};

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
                    team: '',
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
            // NEW: Set team if not already set (sticky)
            if (entry.team && !ridersGC[key].team) {
                ridersGC[key].team = entry.team;
            }
        });
        // NEW: Team points aggregation per race (position-based, not sum of rider points)
        if (config.teamRace) {
            const catRiderLists = {};
            race.forEach(entry => {
                const cat = entry.category;
                if (!catRiderLists[cat]) catRiderLists[cat] = [];
                catRiderLists[cat].push(entry);
            });
            Object.keys(catRiderLists).forEach(cat => {
                const teamGroups = {};
                catRiderLists[cat].forEach(entry => {
                    const normT = normalizeTeam(entry.team);
                    if (normT) {
                        if (!teamGroups[normT]) teamGroups[normT] = [];
                        teamGroups[normT].push(entry);
                    }
                });
                // Collect team sums (top X riders' points)
                const teamSums = [];
                Object.keys(teamGroups).forEach(normT => {
                    const group = teamGroups[normT].slice();
                    group.sort((a, b) => a.position - b.position || parseFloat(a.totalSeconds) - parseFloat(b.totalSeconds));
                    const topX = config.topXRidersCount || group.length;
                    const topRidersPoints = group.slice(0, topX).reduce((sum, r) => sum + r.points, 0);
                    teamSums.push({ normT, sum: topRidersPoints });
                });
                // Rank teams by sum descending (highest points = best team = lowest position)
                teamSums.sort((a, b) => b.sum - a.sum);
                teamSums.forEach((t, idx) => {
                    const pos = idx + 1;  // 1st = 1, 2nd = 2, etc.
                    const teamKey = t.normT + '_' + cat;
                    if (!teamsGC[teamKey]) {
                        teamsGC[teamKey] = {
                            normTeam: t.normT,
                            category: cat,
                            name: teamGroups[t.normT][0].team,  // Original casing
                            totalTeamPoints: 0,
                            teamRacesCompleted: 0,
                            races: new Array(config.numRaces).fill(0)
                        };
                    }
                    const team = teamsGC[teamKey];
                    team.totalTeamPoints += pos;
                    team.races[raceIndex] = pos;
                    if (pos > 0) team.teamRacesCompleted++;
                });
            });
        }
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
    // NEW: Override for team mode (group riders under teams)
    if (config.teamRace) {
        Object.keys(byCategory).forEach(cat => {
            const allRiders = byCategory[cat].complete;  // Points GC: all are "complete"
            const catTeamKeys = Object.keys(teamsGC).filter(key => key.endsWith('_' + cat));
            const catTeams = [];
            catTeamKeys.forEach(teamKey => {
                const team = teamsGC[teamKey];
                team.riders = allRiders
                    .filter(rider => normalizeTeam(rider.team || '') === team.normTeam)
                    .sort((a, b) => b.totalPoints - a.totalPoints);
                if (team.riders.length > 0) {
                    catTeams.push(team);
                }
            });
            catTeams.sort((a, b) => a.totalTeamPoints - b.totalTeamPoints);  // Ascending: lowest total = best = pos 1
            let pos = 1;
            catTeams.forEach((team, index) => {
                if (index > 0 && team.totalTeamPoints === catTeams[index - 1].totalTeamPoints) {
                    team.gcPosition = pos;
                } else {
                    pos = index + 1;
                    team.gcPosition = pos;
                }
            });
            byCategory[cat].teams = catTeams;
            delete byCategory[cat].complete;
            delete byCategory[cat].incomplete;
        });
    }

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

// NEW: Normalize team name for grouping (preserve original casing in display)
function normalizeTeam(team) {
    if (!team) return '';
    return team.toLowerCase().trim()
        .replace(/\s{2,}/g, ' ')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}