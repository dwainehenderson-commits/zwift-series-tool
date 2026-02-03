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
        pointsSystemSelect.addEventListener('change', function() {
            document.getElementById('customPointsDiv').classList.toggle('hidden', this.value !== 'custom');
        });
    }

    // Toggle bonus fields
    const enableBonus = document.getElementById('enableBonus');
    if (enableBonus) {
        enableBonus.addEventListener('change', function() {
            document.getElementById('bonusFields').classList.toggle('hidden', !this.checked);
        });
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

    if (!name || isNaN(numRaces) || numRaces < 1 || numRaces > 20) {
        alert('Please enter a valid series name and number of races (1-20).');
        return;
    }

    const config = { name, numRaces, pointsSystem, customPoints, enableBonus, bonusPoints, gcBasis };
    storeSeriesConfig(config);

    alert('Series configuration saved!');
    document.getElementById('managerPanel').style.display = 'none';
    document.getElementById('raceEntryPanel').classList.remove('hidden');
    populateRaceDropdown(numRaces);
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
    const enableBonus = config?.enableBonus || false;
    const bonusPoints = enableBonus ? config?.bonusPoints || [0, 0, 0] : [0, 0, 0];

    let html = '<table><thead><tr><th>Cat</th><th>Name (editable)</th><th>Time</th><th>Gap</th><th>Points</th></tr></thead><tbody>';
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
            <td><input type="text" value="${r.name.replace(/"/g, '&quot;')}" class="verify-name" data-idx="${idx}"></td>
            <td>${r.time}</td>
            <td>${r.gap || '-'}</td>
            <td>${displayPoints}${bonusDisplay}</td>
        </tr>`;
    });
    html += '</tbody></table>';

    document.getElementById('verificationTableContainer').innerHTML = html;
}

function confirmVerification() {
    const raceNumber = parseInt(document.getElementById('verifyRaceNumber').textContent, 10);
    const parsed = parseZwiftPowerPaste(document.getElementById('pasteArea').value);

    document.querySelectorAll('.verify-name').forEach(input => {
        const idx = parseInt(input.dataset.idx, 10);
        if (!isNaN(idx) && parsed[idx]) {
            parsed[idx].name = input.value.trim();
        }
    });

    closeModal('verificationModal');
    showNameMatchModal(parsed, raceNumber);
}

function showNameMatchModal(parsed, raceNumber) {
    const existingRiders = getExistingRiders();
    const suggestions = [];

    parsed.forEach((r, idx) => {
        const normNew = normalizeRiderName(r.name);
        let bestMatch = null;
        let bestScore = 0;

        Object.keys(existingRiders).forEach(normExist => {
            const score = levenshteinSimilarity(normNew, normExist);
            if (score > 0.82 && score < 1.0 && score > bestScore) {
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

    const tableContainer = document.getElementById('nameMatchTable');
    const buttonsContainer = document.getElementById('nameMatchButtons');
    const messageEl = document.getElementById('nameMatchMessage');

    let html = '';
    let hasSuggestions = suggestions.length > 0;

    if (hasSuggestions) {
        messageEl.textContent = 'Review suggested fuzzy name matches for consistency:';
        html += '<table style="width:100%; border-collapse:collapse;">';
        html += '<thead><tr style="background:#f5f5f5;"><th style="border:1px solid #ddd; padding:10px;">New/Edited Name</th><th style="border:1px solid #ddd; padding:10px;">Suggested Match</th><th style="border:1px solid #ddd; padding:10px;">Similarity</th><th style="border:1px solid #ddd; padding:10px;">Approve?</th></tr></thead>';
        html += '<tbody>';
        suggestions.forEach((s, sIdx) => {
            html += `<tr>
                <td style="border:1px solid #ddd; padding:10px;">${s.originalName}</td>
                <td style="border:1px solid #ddd; padding:10px;">${s.suggestedName}</td>
                <td style="border:1px solid #ddd; padding:10px;">${s.score}</td>
                <td style="border:1px solid #ddd; padding:10px; text-align:center;">
                    <input type="checkbox" class="approve-match" checked data-sidx="${sIdx}">
                </td>
            </tr>`;
        });
        html += '</tbody></table>';

        // Buttons for when suggestions exist
        buttonsContainer.innerHTML = `
            <button onclick="approveAllMatches()" style="margin-right:15px; padding:10px 20px; background:#2196F3; color:white; border:none; border-radius:4px; cursor:pointer;">Approve All Matches</button>
            <button onclick="saveNameMatches()" style="padding:10px 20px; background:#4CAF50; color:white; border:none; border-radius:4px; cursor:pointer;">Save Race with Approved Changes</button>
        `;
    } else {
        messageEl.textContent = 'No fuzzy name matches detected (exact matches are ignored). Ready to save?';
        tableContainer.innerHTML = '';  // Clear table

        // Only single save button when no suggestions
        buttonsContainer.innerHTML = `
            <button onclick="saveNameMatches()" style="padding:12px 40px; font-size:16px; background:#4CAF50; color:white; border:none; border-radius:6px; cursor:pointer;">Save Race</button>
        `;
    }

    document.getElementById('nameMatchModal').classList.remove('hidden');

    window.currentNameSuggestions = suggestions;
    window.currentParsedData = parsed;
    window.currentRaceNumber = raceNumber;
}

function approveAllMatches() {
    document.querySelectorAll('.approve-match').forEach(cb => cb.checked = true);
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
    let html = `<p><strong>Series:</strong> ${config.name} | GC based on: ${config.gcBasis === 'points' ? 'Points' : 'Total Time'}</p>`;

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
        const { complete, incomplete } = gcData[cat];
        const display = index === 0 ? 'block' : 'none';

        html += `<div id="tab-${cat}" class="tab-content" style="display:${display};">`;

        html += `<h3>Category ${cat} - Ranked GC</h3>`;
        html += '<table class="category-table"><thead><tr>';
        html += '<th>GC Pos</th><th>Rider</th>';
        for (let race = 1; race <= config.numRaces; race++) {
            html += `<th>Race ${race}<br>(Pos / Pts / Time)</th>`;
        }
        html += '<th>Total</th></tr></thead><tbody>';

        complete.forEach(rider => {
            html += `<tr><td>${rider.gcPosition}</td><td>${rider.name}</td>`;
            rider.races.forEach(raceData => {
                html += raceData ? `<td>${raceData.position} / ${raceData.points} / ${raceData.time}</td>` : '<td>-</td>';
            });
            const total = config.gcBasis === 'points' ? rider.totalPoints : formatSeconds(rider.totalSeconds);
            html += `<td>${total}</td></tr>`;
        });

        html += '</tbody></table>';

        if (config.gcBasis === 'time' && incomplete.length > 0) {
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
    const matrix = Array(lenA + 1).fill().map(() => Array(lenB + 1).fill(0));

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
                if (!existing[norm]) existing[norm] = { name: entry.name, category: entry.category };
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