const API_URL = 'http://localhost:3000/api';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Modal Elements
const openAddChannelModalBtn = document.getElementById('openAddChannelModalBtn');
const closeAddChannelModalBtn = document.getElementById('closeAddChannelModalBtn');
const addChannelModal = document.getElementById('addChannelModal');
const addChannelBtn = document.getElementById('addChannelBtn');
const refreshDataBtn = document.getElementById('refreshDataBtn');
const exportDataBtn = document.getElementById('exportDataBtn');
const importDataBtn = document.getElementById('importDataBtn');
const importFile = document.getElementById('importFile');
const pinModal = document.getElementById('pinModal');
const closePinModalBtn = document.getElementById('closePinModalBtn');
const submitPinBtn = document.getElementById('submitPinBtn');
const pinInput = document.getElementById('pinInput');
const channelInput = document.getElementById('channelInput');

const channelsGrid = document.getElementById('channelsGrid');
const channelsTableContainer = document.getElementById('channelsTableContainer');
const channelsTableBody = document.getElementById('channelsTableBody');
const toastEl = document.getElementById('toast');
const totalCountEl = document.getElementById('totalCount');
const sortSelect = document.getElementById('sortSelect');
const searchInput = document.getElementById('searchInput');
const cardViewBtn = document.getElementById('cardViewBtn');
const tableViewBtn = document.getElementById('tableViewBtn');
const columnToggleBtn = document.getElementById('columnToggleBtn');
const columnToggleMenu = document.getElementById('columnToggleMenu');

// State
let channels = JSON.parse(localStorage.getItem('telegram_channels')) || [];
let viewMode = localStorage.getItem('viewMode') || 'card'; // 'card' or 'table'
let sortBy = localStorage.getItem('sortBy') || 'name-asc'; // 'name-asc', 'name-desc', 'subs-asc', 'subs-desc'
let searchQuery = '';
let visibleColumns = {
    'col-no': true,
    'col-channel': true,
    'col-status': true,
    'col-subs': true,
    'col-username': true,
    'col-ownership': true,
    'col-added': true,
    'col-desc': false,
    'col-action': true
};

// Merge with localStorage to fix missing keys issue
const savedColumns = JSON.parse(localStorage.getItem('visibleColumns'));
if (savedColumns) {
    visibleColumns = { ...visibleColumns, ...savedColumns };
    // Ensure all keys exist (if new ones were added)
    localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));
}

// Helper: Parse subscriber count string to number
function parseSubscribers(subString) {
    if (!subString) return 0;
    // Remove spaces and non-numeric chars except 'k', 'm' if any (Telegram usually gives "10 000 subscribers")
    let cleanStr = subString.toLowerCase().replace(/subscribers/g, '').trim().replace(/\s/g, '');

    // Handle K/M suffixes if they exist (though Telegram web usually gives full numbers with spaces)
    let multiplier = 1;
    if (cleanStr.includes('k')) {
        multiplier = 1000;
        cleanStr = cleanStr.replace('k', '');
    } else if (cleanStr.includes('m')) {
        multiplier = 1000000;
        cleanStr = cleanStr.replace('m', '');
    }

    return parseFloat(cleanStr) * multiplier || 0;
}

// Helper: Sort Channels
function sortChannels(channelsList) {
    // 1. Assign Rank based on Subscriber Count (descending) regardless of current sort
    // We need a copy to determine rank first
    const rankedList = [...channelsList].sort((a, b) => {
        return parseSubscribers(b.subscribers) - parseSubscribers(a.subscribers);
    });

    // Map username to rank
    const rankMap = {};
    rankedList.forEach((c, index) => {
        rankMap[c.username] = index + 1;
    });

    // 2. Sort based on Ownership Priority + Selected Sort
    return [...channelsList].sort((a, b) => {
        // Ownership Priority: Our > Relative > Competitor
        const ownershipOrder = { 'Our Channel': 1, 'Our Relative Channel': 2, 'Competitor Channel': 3 };
        const ownerA = ownershipOrder[a.ownership || 'Competitor Channel'];
        const ownerB = ownershipOrder[b.ownership || 'Competitor Channel'];

        if (ownerA !== ownerB) {
            return ownerA - ownerB;
        }

        // Secondary Sort (User Selected)
        if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name-desc') return b.name.localeCompare(a.name);

        const subA = parseSubscribers(a.subscribers);
        const subB = parseSubscribers(b.subscribers);

        if (sortBy === 'subs-asc') return subA - subB;
        if (sortBy === 'subs-desc') return subB - subA;
        return 0;
    }).map(c => ({ ...c, rank: rankMap[c.username] })); // Attach rank
}

// Toast Notification
function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`;
    setTimeout(() => {
        toastEl.className = 'toast';
    }, 3000);
}

// Login Logic
if (loginForm) {
    // Check if already logged in
    if (localStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'dashboard.html';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                localStorage.setItem('isLoggedIn', 'true');
                window.location.href = 'dashboard.html';
            } else {
                showToast(data.message || 'Login failed', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        } finally {
            loginBtn.textContent = 'Login';
            loginBtn.disabled = false;
        }
    });
}

// Dashboard Logic
if (window.location.pathname.includes('dashboard.html')) {
    // Auth Check
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html';
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('isLoggedIn');
            window.location.href = 'index.html';
        });
    }

    // Modal Logic
    if (openAddChannelModalBtn && addChannelModal) {
        openAddChannelModalBtn.addEventListener('click', () => {
            addChannelModal.classList.remove('hidden');
        });

        closeAddChannelModalBtn.addEventListener('click', () => {
            addChannelModal.classList.add('hidden');
        });

        // Close on click outside
        addChannelModal.addEventListener('click', (e) => {
            if (e.target === addChannelModal) {
                addChannelModal.classList.add('hidden');
            }
        });
    }

    // View Toggle Logic
    function updateViewMode() {
        if (viewMode === 'card') {
            channelsGrid.classList.remove('hidden');
            channelsTableContainer.classList.add('hidden');
            cardViewBtn.classList.add('active');
            tableViewBtn.classList.remove('active');
        } else {
            channelsGrid.classList.add('hidden');
            channelsTableContainer.classList.remove('hidden');
            cardViewBtn.classList.remove('active');
            tableViewBtn.classList.add('active');
        }
        localStorage.setItem('viewMode', viewMode);
    }

    if (cardViewBtn && tableViewBtn) {
        cardViewBtn.addEventListener('click', () => { viewMode = 'card'; updateViewMode(); });
        tableViewBtn.addEventListener('click', () => { viewMode = 'table'; updateViewMode(); });
        updateViewMode(); // Initial set
    }

    // Sort Logic
    if (sortSelect) {
        sortSelect.value = sortBy;
        sortSelect.addEventListener('change', (e) => {
            sortBy = e.target.value;
            localStorage.setItem('sortBy', sortBy);
            renderChannels();
        });
    }

    // Search Logic
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderChannels();
        });
    }

    // Column Toggle Logic
    if (columnToggleBtn && columnToggleMenu) {
        columnToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            columnToggleMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!columnToggleMenu.contains(e.target) && e.target !== columnToggleBtn) {
                columnToggleMenu.classList.add('hidden');
            }
        });

        // Initialize checkboxes
        Object.keys(visibleColumns).forEach(colId => {
            const checkbox = document.getElementById(colId.replace('col-', 'col-')); // IDs match class names in this implementation
            if (checkbox) {
                checkbox.checked = visibleColumns[colId];
                checkbox.addEventListener('change', (e) => {
                    visibleColumns[colId] = e.target.checked;
                    localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));
                    renderChannels();
                });
            }
        });
    }

    // Refresh Data Logic
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', async () => {
            if (channels.length === 0) return showToast('No channels to refresh', 'error');

            refreshDataBtn.classList.add('loading');
            refreshDataBtn.disabled = true;
            refreshDataBtn.querySelector('span').textContent = 'Refreshing...';

            let updatedCount = 0;
            let errorCount = 0;
            const updatedChannels = [];

            for (const channel of channels) {
                try {
                    const res = await fetch(`${API_URL}/channel`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ channelIdentifier: channel.username })
                    });
                    const data = await res.json();

                    if (data.success) {
                        updatedChannels.push({
                            ...data.data,
                            ownership: channel.ownership,
                            addedOn: channel.addedOn || new Date().toISOString(),
                            status: 'Active'
                        });
                        updatedCount++;
                    } else {
                        // Keep old data but mark inactive if 404
                        updatedChannels.push({
                            ...channel,
                            status: 'Inactive'
                        });
                        errorCount++;
                    }
                } catch (err) {
                    updatedChannels.push({ ...channel, status: 'Inactive' });
                    errorCount++;
                }
            }

            channels = updatedChannels;
            localStorage.setItem('telegram_channels', JSON.stringify(channels));
            renderChannels();

            refreshDataBtn.classList.remove('loading');
            refreshDataBtn.disabled = false;
            refreshDataBtn.querySelector('span').textContent = 'Fetch Live Data';

            showToast(`Refreshed: ${updatedCount} Active, ${errorCount} Inactive`);
        });
    }

    // Export Logic
    if (exportDataBtn && pinModal) {
        exportDataBtn.addEventListener('click', () => {
            pinModal.classList.remove('hidden');
            pinInput.value = '';
            pinInput.focus();
        });

        closePinModalBtn.addEventListener('click', () => {
            pinModal.classList.add('hidden');
        });

        submitPinBtn.addEventListener('click', () => {
            const pin = pinInput.value;
            if (pin === '0103') {
                exportData();
                pinModal.classList.add('hidden');
                showToast('Exporting data...');
            } else {
                showToast('Invalid PIN', 'error');
                pinInput.value = '';
                pinInput.focus();
            }
        });

        // Allow Enter key in PIN input
        pinInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitPinBtn.click();
        });
    }

    function exportData() {
        const headers = ['Rank', 'Name', 'Status', 'Subscribers', 'Username', 'Ownership', 'Added On', 'Description'];
        const rows = channels.map(c => [
            c.rank || '',
            `"${c.name.replace(/"/g, '""')}"`, // Escape quotes
            c.status || 'Active',
            parseSubscribers(c.subscribers),
            c.username,
            c.ownership,
            c.addedOn ? new Date(c.addedOn).toLocaleString() : '',
            `"${(c.description || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `telegram_channels_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }



    // Import Logic
    if (importDataBtn && importFile) {
        importDataBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const csvData = event.target.result;
                processCSV(csvData);
                importFile.value = ''; // Reset
            };
            reader.readAsText(file);
        });
    }

    function processCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return showToast('Invalid CSV format', 'error');

        // Assume header is first line, detect indices
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        const usernameIdx = headers.findIndex(h => h.includes('username'));
        const nameIdx = headers.findIndex(h => h.includes('name'));
        const subsIdx = headers.findIndex(h => h.includes('subscribers'));
        const statusIdx = headers.findIndex(h => h.includes('status'));
        const ownershipIdx = headers.findIndex(h => h.includes('ownership'));
        const addedIdx = headers.findIndex(h => h.includes('added'));
        const descIdx = headers.findIndex(h => h.includes('description'));

        if (usernameIdx === -1) return showToast('CSV must have a Username column', 'error');

        let importedCount = 0;
        let skippedCount = 0;

        // Helper to split CSV line respecting quotes
        const splitCSVLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result.map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"'));
        };

        for (let i = 1; i < lines.length; i++) {
            const cols = splitCSVLine(lines[i]);
            if (cols.length < headers.length) continue;

            const username = cols[usernameIdx];
            if (!username) continue;

            // Check duplicate
            if (channels.find(c => c.username.toLowerCase() === username.toLowerCase())) {
                skippedCount++;
                continue;
            }

            const newChannel = {
                username: username,
                name: nameIdx !== -1 ? cols[nameIdx] : username,
                subscribers: subsIdx !== -1 ? cols[subsIdx] : '0',
                status: statusIdx !== -1 ? cols[statusIdx] : 'Active',
                ownership: ownershipIdx !== -1 ? cols[ownershipIdx] : 'Competitor Channel',
                addedOn: addedIdx !== -1 && cols[addedIdx] ? new Date(cols[addedIdx]).toISOString() : new Date().toISOString(),
                description: descIdx !== -1 ? cols[descIdx] : '',
                image: 'https://via.placeholder.com/64' // Default placeholder, will update on refresh
            };

            channels.push(newChannel);
            importedCount++;
        }

        localStorage.setItem('telegram_channels', JSON.stringify(channels));
        renderChannels();
        showToast(`Imported ${importedCount}, Skipped ${skippedCount}`);
    }

    // Render Channels
    function renderChannels() {
        // Filter by Search
        let filteredChannels = channels;
        if (searchQuery) {
            filteredChannels = channels.filter(c =>
                c.name.toLowerCase().includes(searchQuery) ||
                c.username.toLowerCase().includes(searchQuery)
            );
        }

        if (totalCountEl) totalCountEl.textContent = filteredChannels.length;

        // Ensure all channels have ownership property
        filteredChannels = filteredChannels.map(c => ({
            ...c,
            ownership: c.ownership || 'Competitor Channel',
            status: c.status || 'Active', // Default to active for existing
            addedOn: c.addedOn || new Date().toISOString() // Default to now for existing
        }));

        const sortedChannels = sortChannels(filteredChannels);

        // Render Grid
        if (channelsGrid) {
            channelsGrid.innerHTML = '';
            sortedChannels.forEach(channel => {
                const card = document.createElement('div');
                card.className = 'channel-card';
                // Add border color based on ownership for visual cue in card view too
                if (channel.ownership === 'Our Channel') card.style.borderColor = 'var(--success-color)';
                else if (channel.ownership === 'Our Relative Channel') card.style.borderColor = 'var(--accent-color)';

                // Opacity for inactive
                if (channel.status === 'Inactive') card.style.opacity = '0.6';

                card.onclick = (e) => {
                    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') {
                        window.open(`https://t.me/${channel.username}`, '_blank');
                    }
                };
                card.innerHTML = `
                    <img src="${channel.image || 'https://via.placeholder.com/64'}" alt="${channel.name}" class="channel-img">
                    <div class="channel-info">
                        <div class="channel-name">${channel.name} 
                            ${channel.status === 'Inactive' ? '<span style="color:var(--error-color); font-size:0.7rem;">(Inactive)</span>' : ''}
                        </div>
                        <div class="channel-username">@${channel.username}</div>
                        <div class="channel-subs">${parseSubscribers(channel.subscribers).toLocaleString().replace(/,/g, ' ')} subscribers</div>
                        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">${channel.ownership}</div>
                    </div>
                    <button onclick="removeChannel('${channel.username}')" style="width:auto; padding:0.5rem; background:transparent; color:#ef4444; border:1px solid #ef4444; z-index:2;">✕</button>
                `;
                channelsGrid.appendChild(card);
            });
        }

        // Render Table
        if (channelsTableBody) {
            // Update Header Visibility
            Object.keys(visibleColumns).forEach(colClass => {
                const ths = document.querySelectorAll(`th.${colClass}`);
                ths.forEach(th => {
                    if (visibleColumns[colClass]) th.classList.remove('hidden');
                    else th.classList.add('hidden');
                });
            });

            channelsTableBody.innerHTML = '';
            sortedChannels.forEach(channel => {
                const row = document.createElement('tr');
                row.onclick = (e) => {
                    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
                        window.open(`https://t.me/${channel.username}`, '_blank');
                    }
                };

                const ownershipOptions = ['Our Channel', 'Our Relative Channel', 'Competitor Channel']
                    .map(opt => `<option value="${opt}" ${channel.ownership === opt ? 'selected' : ''}>${opt}</option>`)
                    .join('');

                const addedDate = new Date(channel.addedOn).toLocaleDateString() + ' ' + new Date(channel.addedOn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                row.innerHTML = `
                    <td class="col-no ${visibleColumns['col-no'] ? '' : 'hidden'}" style="font-weight:bold; color:var(--text-secondary);">#${channel.rank}</td>
                    <td class="col-channel ${visibleColumns['col-channel'] ? '' : 'hidden'}">
                        <div class="table-channel-info">
                            <img src="${channel.image || 'https://via.placeholder.com/40'}" alt="${channel.name}" class="table-channel-img">
                            <span>${channel.name}</span>
                        </div>
                    </td>
                    <td class="col-status ${visibleColumns['col-status'] ? '' : 'hidden'}">
                        <span class="status-badge ${channel.status === 'Active' ? 'status-active' : 'status-inactive'}">${channel.status}</span>
                    </td>
                    <td class="col-subs ${visibleColumns['col-subs'] ? '' : 'hidden'}" style="color:var(--accent-color); font-weight:600;">${parseSubscribers(channel.subscribers).toLocaleString().replace(/,/g, '')}</td>
                    <td class="col-username ${visibleColumns['col-username'] ? '' : 'hidden'}" style="color:var(--text-secondary);">@${channel.username}</td>
                    <td class="col-ownership ${visibleColumns['col-ownership'] ? '' : 'hidden'}">
                        <select class="ownership-select" onchange="updateOwnership('${channel.username}', this.value)" onclick="event.stopPropagation()">
                            ${ownershipOptions}
                        </select>
                    </td>
                    <td class="col-added ${visibleColumns['col-added'] ? '' : 'hidden'}">${addedDate}</td>
                    <td class="col-desc ${visibleColumns['col-desc'] ? '' : 'hidden'}" title="${channel.description || ''}">${channel.description || '-'}</td>
                    <td class="col-action ${visibleColumns['col-action'] ? '' : 'hidden'}">
                        <button onclick="removeChannel('${channel.username}')" style="width:auto; padding:0.25rem 0.5rem; background:transparent; color:#ef4444; border:1px solid #ef4444; font-size:0.8rem;">Remove</button>
                    </td>
                `;
                channelsTableBody.appendChild(row);
            });
        }
    }

    // Update Ownership Global Function
    window.updateOwnership = (username, newOwnership) => {
        const channel = channels.find(c => c.username === username);
        if (channel) {
            channel.ownership = newOwnership;
            localStorage.setItem('telegram_channels', JSON.stringify(channels));
            renderChannels(); // Re-render to update sorting
            showToast(`Updated ownership to ${newOwnership}`);
        }
    };

    // Add Channel
    if (addChannelBtn) {
        addChannelBtn.addEventListener('click', async () => {
            const inputVal = channelInput.value.trim();
            if (!inputVal) return showToast('Please enter at least one channel', 'error');

            const lines = inputVal.split('\n').map(line => line.trim()).filter(line => line.length > 0);

            if (lines.length === 0) return showToast('Please enter valid channel names', 'error');

            addChannelBtn.textContent = `Processing ${lines.length}...`;
            addChannelBtn.disabled = true;

            let addedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            for (const line of lines) {
                try {
                    // 1. Basic duplicate check (optimization)
                    // If the user entered a simple username that we already have, skip API call
                    const simpleMatch = channels.find(c =>
                        c.username.toLowerCase() === line.toLowerCase().replace('@', '').replace('t.me/', '').replace('https://', '').replace('http://', '')
                    );
                    if (simpleMatch) {
                        skippedCount++;
                        continue;
                    }

                    // 2. Fetch data
                    const res = await fetch(`${API_URL}/channel`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ channelIdentifier: line })
                    });
                    const data = await res.json();

                    if (data.success) {
                        // 3. Strict duplicate check after resolving username
                        if (!channels.find(c => c.username === data.data.username)) {
                            channels.push({
                                ...data.data,
                                addedOn: new Date().toISOString(),
                                status: 'Active',
                                ownership: 'Competitor Channel'
                            });
                            addedCount++;
                        } else {
                            skippedCount++;
                        }
                    } else {
                        errorCount++;
                    }
                } catch (err) {
                    errorCount++;
                }
            }

            // Update UI
            localStorage.setItem('telegram_channels', JSON.stringify(channels));
            renderChannels();

            // Summary Message
            let msg = [];
            if (addedCount > 0) msg.push(`Added ${addedCount}`);
            if (skippedCount > 0) msg.push(`Skipped ${skippedCount} (Duplicate)`);
            if (errorCount > 0) msg.push(`Failed ${errorCount} (Invalid)`);

            const type = addedCount > 0 ? 'success' : (errorCount > 0 ? 'error' : 'success');
            showToast(msg.join(', '), type);

            if (addedCount > 0) {
                channelInput.value = '';
                addChannelModal.classList.add('hidden'); // Close modal on success
            }

            addChannelBtn.textContent = 'Add Channels';
            addChannelBtn.disabled = false;
        });
    }

    // Remove Channel Global Function
    window.removeChannel = (username) => {
        channels = channels.filter(c => c.username !== username);
        localStorage.setItem('telegram_channels', JSON.stringify(channels));
        renderChannels();
        showToast('Channel removed');
    };

    // Initial Render
    renderChannels();

    // Auto Refresh (Every 30s)
    setInterval(async () => {
        console.log('Refreshing data...');
        const updatedChannels = [];
        for (const channel of channels) {
            try {
                const res = await fetch(`${API_URL}/channel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channelIdentifier: channel.username })
                });
                const data = await res.json();
                if (data.success) {
                    updatedChannels.push({
                        ...data.data,
                        ownership: channel.ownership,
                        addedOn: channel.addedOn,
                        status: 'Active'
                    });
                } else {
                    updatedChannels.push({ ...channel, status: 'Inactive' });
                }
            } catch (err) {
                updatedChannels.push(channel);
            }
        }
        channels = updatedChannels;
        localStorage.setItem('telegram_channels', JSON.stringify(channels));
        renderChannels();
    }, 30000);
}

