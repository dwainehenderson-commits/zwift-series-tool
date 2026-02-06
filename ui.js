// ui.js - COMPLETE & CLEAN (with dropdown marking saved races)

function initApp() {
    const config = loadSeriesConfig();
    if (config) {
        document.getElementById('managerPanel').style.display = 'none';
        document.getElementById('raceEntryPanel').classList.remove('hidden');
        populateRaceDropdown(config.numRaces);
        renderLeaderboard();
    }

    // Toggle custom points field
    const pointsSystemSelect = document.getElementById('pointsSystem');
    if (pointsSystemSelect) {
        pointsSystemSelect.addEventListener('change', function () {
            document.getElementById('customPointsDiv').classList.toggle('hidden', this.value !== 'custom');
        });
    }

    // NEW: Race desc inputs
    const numRacesInput = document.getElementById('numRaces');
    if (numRacesInput) {
        numRacesInput.addEventListener('input', handleNumRacesChange);
        handleNumRacesChange.call(numRacesInput);  // Init with default value=5
    }

    // Toggle bonus fields
    const enableBonus = document.getElementById('enableBonus');
    if (enableBonus) {
        enableBonus.addEventListener('change', function () {
            document.getElementById('bonusFields').classList.toggle('hidden', !this.checked);
        });
    }

    // NEW: Team race toggles
    const teamRaceCb = document.getElementById('teamRace');
    if (teamRaceCb) {
        teamRaceCb.addEventListener('change', toggleTeamOptions);
    }
    const useTopXCb = document.getElementById('useTopXRiders');
    if (useTopXCb) {
        useTopXCb.addEventListener('change', toggleTopXField);
    }
    toggleGcBasis();  // Initial state
}

// NEW: Team toggle functions
function toggleTeamOptions() {
    const checked = document.getElementById('teamRace').checked;
    document.getElementById('teamOptions').classList.toggle('hidden', !checked);
    toggleGcBasis();
}

function toggleTopXField() {
    const checked = document.getElementById('useTopXRiders').checked;
    document.getElementById('topXFieldDiv').classList.toggle('hidden', !checked);
}

function toggleGcBasis() {
    const teamChecked = document.getElementById('teamRace')?.checked || false;
    const select = document.getElementById('gcBasis');
    if (!select) return;
    const timeOpt = Array.from(select.options).find(opt => opt.value === 'time');
    if (timeOpt) {
        timeOpt.disabled = teamChecked;
        if (teamChecked) {
            select.value = 'points';
        }
    }
}

function handleNumRacesChange() {
    const numRaces = parseInt(this.value) || 0;
    updateRaceDescInputs(numRaces);
}

function updateRaceDescInputs(numRaces) {
    const container = document.getElementById('raceDescriptionsContainer');
    if (!container) return;

    container.innerHTML = '';
    for (let i = 1; i <= numRaces; i++) {
        const label = document.createElement('label');
        label.htmlFor = `raceDesc${i}`;
        label.textContent = `Race ${i} Description (optional):`;
        label.style.display = 'block';
        label.style.marginTop = '10px';

        const textarea = document.createElement('textarea');
        textarea.id = `raceDesc${i}`;
        textarea.rows = 4;
        textarea.placeholder = 'Race description (e.g., course, weather, special rules)';
        textarea.style.width = '300px';
        textarea.style.fontFamily = 'Arial, sans-serif';
        textarea.style.padding = '6px';

        container.appendChild(label);
        container.appendChild(textarea);
        if (i < numRaces) container.appendChild(document.createElement('br'));
    }
}

function saveSeriesConfig() {
    const name = document.getElementById('seriesName').value.trim();
    const numRaces = parseInt(document.getElementById('numRaces').value, 10);
    const pointsSystem = document.getElementById('pointsSystem').value;
    let customPoints = null;
    if (pointsSystem === 'custom') {
        customPoints = document.getElementById('customPointsInput').value.trim().split(',').map(n => parseInt(n.trim(), 10));
        if (customPoints.some(isNaN)) {
            alert('Custom points must be comma-separated numbers.');
            return;
        }
    }
    const enableBonus = document.getElementById('enableBonus').checked;
    let bonusPoints = null;
    if (enableBonus) {
        bonusPoints = document.getElementById('bonusInput').value.trim().split(',').map(n => parseInt(n.trim(), 10));
        if (bonusPoints.length !== 3 || bonusPoints.some(isNaN)) {
            alert('Bonus points must be exactly 3 comma-separated numbers.');
            return;
        }
    }
    const gcBasis = document.getElementById('gcBasis').value;
    const description = document.getElementById('seriesDescription').value.trim();

    // NEW: Team race config
    const teamRace = document.getElementById('teamRace').checked || false;
    let topXRidersCount = null;
    if (teamRace) {
        if (gcBasis === 'time') {
            alert('Team Race Mode only supports Points-based GC.');
            return;
        }
        const useTopX = document.getElementById('useTopXRiders').checked || false;
        if (useTopX) {
            const countStr = document.getElementById('topXRidersCount').value.trim();
            const count = parseInt(countStr, 10);
            if (isNaN(count) || count < 1 || count > 20) {
                alert('Top X count must be a number between 1 and 20.');
                return;
            }
            topXRidersCount = count;
        }
    }

    const raceDescriptions = [];
    for (let i = 1; i <= numRaces; i++) {
        const el = document.getElementById(`raceDesc${i}`);
        raceDescriptions.push(el ? el.value.trim() : '');
    }

    if (!name || isNaN(numRaces) || numRaces < 1 || numRaces > 20) {
        alert('Please enter a valid series name and number of races (1-20).');
        return;
    }

    const config = {
        name,
        numRaces,
        pointsSystem,
        customPoints,
        enableBonus,
        bonusPoints,
        gcBasis,
        description,
        raceDescriptions,
        // NEW
        teamRace,
        topXRidersCount
    };
    storeSeriesConfig(config);

    alert('Series configuration saved!');
    document.getElementById('managerPanel').style.display = 'none';
    document.getElementById('raceEntryPanel').classList.remove('hidden');
    populateRaceDropdown(numRaces);
    showSeriesInfoInEntry(config);
    renderLeaderboard();
}

function populateRaceDropdown(numRaces) {
    const select = document.getElementById('raceNumber');
    if (!select) return;

    const races = loadAllRaces() || [];  // ensure array
    console.log('Loaded races array length:', races.length); // debug

    let nextRace = 1;

    // Find first unsaved race (1-based)
    for (let n = 0; n < numRaces; n++) {
        if (typeof races[n] === 'undefined' || races[n] === null || !Array.isArray(races[n])) {
            nextRace = n + 1;
            break;
        }
    }
    // If all saved, default to last
    if (nextRace === 1 && races.length >= numRaces) {
        nextRace = numRaces;
    }

    console.log('Next race default:', nextRace); // debug

    select.innerHTML = '';
    for (let n = 1; n <= numRaces; n++) {
        const option = document.createElement('option');
        option.value = String(n);  // ← fixed: explicit string
        const isSaved = races[n - 1] && Array.isArray(races[n - 1]) && races[n - 1].length > 0;
        option.textContent = isSaved ? `Race ${n} (Saved)` : `Race ${n}`;
        if (n === nextRace) {
            option.selected = true;
        }
        select.appendChild(option);
    }
}

function parseAndSaveRace() {
    const text = document.getElementById('pasteArea').value.trim();
    if (!text) {
        alert('Please paste some results first.');
        return;
    }

    const raceNumber = parseInt(document.getElementById('raceNumber').value, 10);
    const parsed = parseZwiftPowerPaste(text);

    if (parsed.length === 0) {
        alert('No riders could be parsed. Check the pasted format.');
        return;
    }

    document.getElementById('verifyRaceNumber').textContent = raceNumber;
    buildVerificationTable(parsed, raceNumber);
    document.getElementById('verificationModal').classList.remove('hidden');
}

function buildVerificationTable(parsed, raceNumber) {
    const config = loadSeriesConfig();
    const isTeamRace = config?.teamRace || false;
    const enableBonus = config?.enableBonus || false;
    const bonusPoints = enableBonus ? config?.bonusPoints || [0, 0, 0] : [0, 0, 0];

    // NEW: For team mode, collect existing teams and rider-team mappings from previous races
    let allTeams = new Set();
    let riderTeams = {};
    let datalistHtml = '';
    if (isTeamRace) {
        const allRaces = loadAllRaces();
        const previousRaces = allRaces.slice(0, raceNumber - 1);
        previousRaces.forEach(raceData => {
            if (!Array.isArray(raceData)) return;
            raceData.forEach(entry => {
                const team = entry.team || '';
                if (team.trim()) {
                    allTeams.add(team);
                    const normName = normalizeRiderName(entry.name);
                    const key = normName + '_' + entry.category;
                    riderTeams[key] = team;  // Last seen wins for prefill
                }
            });
        });
        datalistHtml = '<datalist id="teamDatalist">';
        Array.from(allTeams).sort((a, b) => a.localeCompare(b)).forEach(team => {
            datalistHtml += `<option value="${team.replace(/"/g, '&quot;')}">`;
        });
        datalistHtml += '</datalist>';
    }

    let html = '<table><thead><tr><th>Cat</th><th>Name (editable)</th>';
    if (isTeamRace) {
        html += '<th>Team</th>';
    }
    html += '<th>Time</th><th>Gap</th><th>Points</th></tr></thead><tbody>';
    parsed.forEach((r, idx) => {
        let displayPoints = r.points || 0;
        let bonusDisplay = '';

        if (enableBonus && r.position <= 3) {
            const bonus = bonusPoints[r.position - 1] || 0;
            if (bonus > 0) {
                displayPoints += bonus;
                bonusDisplay = ` <small style="color:#2e7d32">+${bonus}pbp</small>`;
            }
        }

        html += `<tr>
                <td>${r.category}</td>
                <td><input type="text" value="${r.name.replace(/"/g, '&quot;')}" class="verify-name" data-idx="${idx}"></td>`;
        if (isTeamRace) {
            const normName = normalizeRiderName(r.name);
            const suggestedTeam = riderTeams[normName + '_' + r.category] || '';
            const isFixed = !!suggestedTeam;
            const teamAttrs = isFixed ? 'readonly title="Previously assigned team (fixed)" class="verify-team fixed-team"' : 'class="verify-team" list="teamDatalist"';
            html += `<td><input type="text" value="${suggestedTeam.replace(/"/g, '&quot;')}" ${teamAttrs} data-idx="${idx}"></td>`;
        }
        html += `
                <td>${r.time}</td>
                <td>${r.gap || '-'}</td>
                <td>${displayPoints}${bonusDisplay}</td>
            </tr>`;
    });
    html += '</tbody></table>';

    document.getElementById('verificationTableContainer').innerHTML = datalistHtml + html;

    // NEW: Dynamic datalist updates + listeners (team mode only)
    if (isTeamRace) {
        const updateTeamDatalist = () => {
            const inputs = document.querySelectorAll('.verify-team');
            const teamsSet = new Set();
            inputs.forEach(input => {
                const val = input.value.trim();
                if (val) teamsSet.add(val);
            });
            const datalist = document.getElementById('teamDatalist');
            if (datalist) {
                datalist.innerHTML = Array.from(teamsSet).sort((a, b) => a.localeCompare(b))
                    .map(team => `<option value="${team.replace(/"/g, '&quot;')}">`).join('');
            }
        };

        document.querySelectorAll('.verify-team').forEach(input => {
            input.addEventListener('blur', updateTeamDatalist);
        });
        updateTeamDatalist();  // Initial sync
    }
}

function confirmVerification() {
    const raceNumber = parseInt(document.getElementById('verifyRaceNumber').textContent, 10);
    const pastedText = document.getElementById('pasteArea').value;
    const parsed = parseZwiftPowerPaste(pastedText);

    // Update names
    document.querySelectorAll('.verify-name').forEach(input => {
        const idx = parseInt(input.dataset.idx, 10);
        if (!isNaN(idx) && parsed[idx]) {
            parsed[idx].name = input.value.trim();
        }
    });

    // NEW: Update teams if team mode + validate all editable filled
    const config = loadSeriesConfig();
    if (config?.teamRace) {
        let allEditableFilled = true;
        document.querySelectorAll('.verify-team:not([readonly])').forEach(input => {
            const idx = parseInt(input.dataset.idx, 10);
            const teamVal = input.value.trim();
            if (parsed[idx]) {
                parsed[idx].team = teamVal;
            }
            if (!teamVal) {
                allEditableFilled = false;
            }
        });
        if (!allEditableFilled) {
            alert('All editable team fields must be filled before confirming.');
            return;
        }
    }

    closeModal('verificationModal');
    showNameMatchModal(parsed, raceNumber);
}

// Name matching modal. Fuzzy threshold set to 0.55 (55% similarity)
function showNameMatchModal(parsed, raceNumber) {
    const existingRiders = getExistingRiders();
    const suggestions = [];

    parsed.forEach((r, idx) => {
        const normNew = normalizeRiderName(r.name);
        let bestMatch = null;
        let bestScore = 0;

        Object.keys(existingRiders).forEach(normExist => {
            const score = levenshteinSimilarity(normNew, normExist);
            if (score > 0.55 && score < 1.0 && score > bestScore) {  // Your 70% threshold
                bestScore = score;
                bestMatch = existingRiders[normExist].name;
            }
        });

        if (bestMatch) {
            suggestions.push({
                originalName: r.name,
                suggestedName: bestMatch,
                score: (bestScore * 100).toFixed(0) + '%',
                category: r.category,
                index: idx
            });
        }
    });

    let html = '<div style="padding: 20px;">';

    if (suggestions.length > 0) {
        // Matches exist → show the suggestions table + buttons
        html += '<p style="margin-bottom: 15px; font-weight: bold;">Review suggested fuzzy name matches:</p>';
        html += '<table style="width:100%; border-collapse:collapse;">';
        html += '<thead><tr style="background:#f5f5f5;"><th style="border:1px solid #ddd; padding:10px;">New/Edited Name</th><th style="border:1px solid #ddd; padding:10px;">Suggested Match</th><th style="border:1px solid #ddd; padding:10px;">Similarity</th><th style="border:1px solid #ddd; padding:10px;">Approve?</th></tr></thead>';
        html += '<tbody>';
        suggestions.forEach((s, sIdx) => {
            html += `<tr class="name-match-row unapproved" data-sidx="${sIdx}">
    <td style="border:1px solid #ddd; padding:10px;">${s.originalName}</td>
    <td style="border:1px solid #ddd; padding:10px;">${s.suggestedName}</td>
    <td style="border:1px solid #ddd; padding:10px;">${s.score}</td>
    <td style="border:1px solid #ddd; padding:10px; text-align:center;">
        <input type="checkbox" class="approve-match" data-sidx="${sIdx}">
    </td>
</tr>`;
        });
        html += '</tbody></table>';
        html += '<br>';
        html += '<button onclick="approveAllMatches()" style="margin-right:15px; padding:10px 20px; background:#2196F3; color:white; border:none; border-radius:4px; cursor:pointer;">Approve All Matches</button>';
        html += '<button onclick="saveNameMatches()" style="padding:10px 20px; background:#4CAF50; color:white; border:none; border-radius:4px; cursor:pointer;">Save Race with Approved Changes</button>';
    } else {
        // No matches → simple message + single save button (no list/table)
        html += '<p style="color:#555; font-style:italic; margin:30px 0; font-size:1.1em;">';
        html += 'No fuzzy name matches detected (exact matches are ignored). Ready to save?</p>';
        html += '<button onclick="saveNameMatches()" style="padding:12px 40px; font-size:16px; background:#4CAF50; color:white; border:none; border-radius:6px; cursor:pointer;">Save Race</button>';
    }

    html += '</div>';

    document.getElementById('nameMatchTable').innerHTML = html;

    // Add change listeners to checkboxes to toggle row color
    document.querySelectorAll('.approve-match').forEach(checkbox => {
        const row = checkbox.closest('tr');  // Find parent <tr>
        if (row) {
            // Initial state: unchecked = unapproved (light red)
            row.classList.add('unapproved');
            row.classList.remove('approved');

            checkbox.addEventListener('change', function () {
                if (this.checked) {
                    row.classList.remove('unapproved');
                    row.classList.add('approved');
                } else {
                    row.classList.remove('approved');
                    row.classList.add('unapproved');
                }
            });
        }
    });

    // NEW: Force row highlight update when "Approve All" is clicked
    const approveAllBtn = document.querySelector('button[onclick="approveAllMatches()"]');
    if (approveAllBtn) {
        approveAllBtn.addEventListener('click', () => {
            // Give checkboxes time to update (tiny delay)
            setTimeout(() => {
                document.querySelectorAll('.approve-match').forEach(checkbox => {
                    const row = checkbox.closest('tr');
                    if (row) {
                        if (checkbox.checked) {
                            row.classList.remove('unapproved');
                            row.classList.add('approved');
                        } else {
                            row.classList.remove('approved');
                            row.classList.add('unapproved');
                        }
                    }
                });
            }, 50);  // Small delay to ensure checked state is applied
        });
    }
    document.getElementById('nameMatchModal').classList.remove('hidden');

    window.currentNameSuggestions = suggestions;
    window.currentParsedData = parsed;
    window.currentRaceNumber = raceNumber;
}

function approveAllMatches() {
    console.log('Approve All Matches button clicked!');  // ← add this
    document.querySelectorAll('.approve-match').forEach(cb => {
        cb.checked = true;
    });
}

function saveNameMatches() {
    let parsed = window.currentParsedData;
    const suggestions = window.currentNameSuggestions;
    const raceNumber = window.currentRaceNumber;

    let changesMade = 0;

    document.querySelectorAll('.approve-match').forEach((cb, sIdx) => {
        if (cb.checked) {
            const s = suggestions[sIdx];
            if (s && s.originalName !== s.suggestedName) {
                parsed[s.index].name = s.suggestedName;
                changesMade++;
            }
        }
    });

    saveRaceResults(raceNumber, parsed);

    document.getElementById('pasteArea').value = '';
    closeModal('nameMatchModal');

    alert(`Race ${raceNumber} saved. ${changesMade} name${changesMade === 1 ? '' : 's'} updated based on approvals.`);
    renderLeaderboard();
    populateRaceDropdown(loadSeriesConfig().numRaces);  // Refresh dropdown after save
    showSeriesInfoInEntry(loadSeriesConfig());

    window.currentNameSuggestions = null;
    window.currentParsedData = null;
    window.currentRaceNumber = null;
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
}

function renderLeaderboard() {
    const config = loadSeriesConfig();
    if (!config) {
        document.getElementById('leaderboardContainer').innerHTML = '<p>No series configured yet.</p>';
        return;
    }

    const gcData = computeGC(config);
    let html = `<div class="info-box"><strong>${config.name}</strong>`;
    html += `<br><small>GC based on: ${config.gcBasis === 'points' ? 'Total Points' : 'Total Time'}`;
    // NEW: Race type display
    const raceType = config.teamRace ? 'Team' : 'Individual';
    const topXNote = config.topXRidersCount ? ` (Top ${config.topXRidersCount} riders/team)` : '';
    html += ` | Race Type: ${raceType}${topXNote}</small>`;
    if (config.description?.trim()) {
        html += `<br><br>${config.description}`;
    }
    html += `</div>`;

    // NEW: Per-race descriptions (single info-box)
    if (config.raceDescriptions) {
        const raceDescList = [];
        config.raceDescriptions.forEach((desc, index) => {
            if (desc?.trim()) {
                raceDescList.push(`<li><strong>Race ${index + 1}:</strong><br>${desc.replace(/\n/g, '<br>')}</li>`);
            }
        });
        if (raceDescList.length > 0) {
            html += `<div class="info-box"><strong>Race Descriptions:</strong><ul style="margin-top: 10px;">${raceDescList.join('')}</ul></div>`;
        }
    }

    if (config.gcBasis === 'time') {
        html += '<p><em>Note: Only riders who completed ALL races are ranked in the main table. Riders with missing races are listed below as incomplete.</em></p>';
    }

    html += '<div class="tabs">';
    Object.keys(gcData).sort().forEach((cat, index) => {
        const active = index === 0 ? ' active' : '';
        html += `<button class="tab-button${active}" onclick="openCategoryTab('${cat}')">Category ${cat}</button>`;
    });
    html += '</div>';

    Object.keys(gcData).sort().forEach((cat, index) => {
        const complete = gcData[cat]?.complete || [];
        const incomplete = gcData[cat]?.incomplete || [];
        const teams = gcData[cat]?.teams || [];
        const display = index === 0 ? 'block' : 'none';

        html += `<div id="tab-${cat}" class="tab-content" style="display:${display};">`;
        html += `<h3>Category ${cat} - ${config.teamRace ? 'Team' : 'Individual'} GC</h3>`;
        html += '<table class="category-table">';
        // Dynamic headers
        html += '<thead><tr><th>GC Pos</th>';
        if (config.teamRace) {
            html += '<th>Team</th>';
        }
        html += '<th>Rider</th>';
        for (let race = 1; race <= config.numRaces; race++) {
            html += `<th>Race ${race}<br>(Pos / Pts / Time)</th>`;
        }
        if (config.teamRace) {
            html += '<th>Rider Total</th><th>Team Total</th>';
        } else {
            html += '<th>Total</th>';
        }
        html += '</tr></thead><tbody>';

        // Dynamic rows
        if (config.teamRace && teams.length > 0) {
            teams.forEach(team => {
                if (team.riders && team.riders.length > 0) {
                    team.riders.forEach(rider => {
                        html += `<tr>
                                    <td>${team.gcPosition || '-'}</td>
                                    <td>${team.name}</td>
                                    <td>${rider.name}</td>`;
                        rider.races.forEach(raceData => {
                            html += raceData ? `<td>${raceData.position} / ${raceData.points} / ${raceData.time}</td>` : '<td>-</td>';
                        });
                        html += `<td>${rider.totalPoints}</td>
                                    <td>${team.totalTeamPoints}</td>
                                </tr>`;
                    });
                }
            });
        } else {
            // Individual mode: complete riders
            complete.forEach(rider => {
                html += `<tr><td>${rider.gcPosition}</td><td>${rider.name}</td>`;
                rider.races.forEach(raceData => {
                    html += raceData ? `<td>${raceData.position} / ${raceData.points} / ${raceData.time}</td>` : '<td>-</td>';
                });
                const total = config.gcBasis === 'points' ? rider.totalPoints : formatSeconds(rider.totalSeconds);
                html += `<td>${total}</td></tr>`;
            });
        }
        html += '</tbody></table>';

        // Incomplete section (individual time GC only)
        if (config.gcBasis === 'time' && !config.teamRace && incomplete.length > 0) {
            html += `<h4>Incomplete Participation</h4>`;
            html += '<table class="category-table"><thead><tr><th>Rider</th>';
            for (let race = 1; race <= config.numRaces; race++) {
                html += `<th>Race ${race}</th>`;
            }
            html += '<th>Completed</th></tr></thead><tbody>';
            incomplete.forEach(rider => {
                html += `<tr><td>${rider.name}</td>`;
                rider.races.forEach(raceData => {
                    html += `<td>${raceData ? raceData.position : '-'}</td>`;
                });
                html += `<td>${rider.racesCompleted} / ${config.numRaces}</td></tr>`;
            });
            html += '</tbody></table>';
        }

        html += '</div>';
    });

    document.getElementById('leaderboardContainer').innerHTML = html;
    addSortingToTables();
}

function openCategoryTab(category) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

    const tab = document.getElementById(`tab-${category}`);
    if (tab) tab.style.display = 'block';

    const button = document.querySelector(`.tab-button[onclick="openCategoryTab('${category}')"]`);
    if (button) button.classList.add('active');
}

function formatSeconds(secs) {
    const min = Math.floor(secs / 60);
    const sec = Math.round(secs % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
}

function addSortingToTables() {
    document.querySelectorAll('.category-table th').forEach((th, index) => {
        th.addEventListener('click', () => {
            const table = th.closest('table');
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            const rows = Array.from(tbody.rows);

            rows.sort((a, b) => {
                let valA = a.cells[index].textContent.trim();
                let valB = b.cells[index].textContent.trim();

                if (!isNaN(valA) && !isNaN(valB)) {
                    return parseFloat(valA) - parseFloat(valB);
                }
                return valA.localeCompare(valB);
            });

            tbody.innerHTML = '';
            rows.forEach(row => tbody.appendChild(row));
        });
    });
}

function normalizeRiderName(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s*\[.*?\]/g, '')
        .replace(/\s*\(.*?\)/g, '')
        .replace(/\d{4,}/g, '')
        .replace(/[^a-z\s]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function levenshteinSimilarity(a, b) {
    if (a === b) return 1.0;
    const lenA = a.length, lenB = b.length;
    const matrix = Array(lenA + 1).fill().map(() => Array(lenB + 1).fill(0));  // Fixed syntax

    for (let i = 0; i <= lenA; i++) matrix[i][0] = i;
    for (let j = 0; j <= lenB; j++) matrix[0][j] = j;

    for (let i = 1; i <= lenA; i++) {
        for (let j = 1; j <= lenB; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return (Math.max(lenA, lenB) - matrix[lenA][lenB]) / Math.max(lenA, lenB);
}

function getExistingRiders() {
    const races = loadAllRaces();
    const existing = {};
    races.forEach(race => {
        if (race) {
            race.forEach(entry => {
                const norm = normalizeRiderName(entry.name);
                if (!existing[norm]) existing[norm] = {name: entry.name, category: entry.category};
            });
        }
    });
    return existing;
}

// Clear all data (called from buttons)
function clearAllDataFunc() {
    if (confirm('This will permanently delete ALL series config, race results, and cached data. Are you sure?')) {
        clearAllData();  // Calls the function from data.js
        location.reload();
    }
}