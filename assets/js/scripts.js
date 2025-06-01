const options = {
    method: 'GET',
    headers: {
        Accept: 'application/json',
        'User-Agent': 'insomnia/8.6.0',
        Authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJkMDQ0ZjVjMC1hNmQwLTAxM2MtMWJiMC00ZTkzYjJmODk1MTIiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzA3MTkxNDM4LCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6ImNsYiJ9.MPyYsFgu8lEC3HtaDjeegO5NfavVkLw1NSST3jsUcyU'
    }
};

const postsContainer = document.querySelector("#posts-container")

async function loadTeams() {
    try {
        const response = await fetch('https://opensheet.elk.sh/1_GzjxfPEpIQbPur7uQlW_h0K51Mbd0W8GtEVgQ3mLuc/slots');
        const teamsData = await response.json();

        // Converter array [{slot: "3", team: "Nome"}] em objeto { "3": "Nome" }
        const teamsMap = {};
        teamsData.forEach(item => {
            teamsMap[item.slot] = item.team;
        });

        return teamsMap;
    } catch (error) {
        console.error('Erro ao carregar os dados dos times:', error);
        return {};
    }
}

const toggleButton = document.getElementById('toggleServer');

toggleButton.addEventListener('click', () => {
    const currentServer = toggleButton.getAttribute('data-server');
    const newServer = currentServer === 'steam' ? 'tournament' : 'steam';

    toggleButton.setAttribute('data-server', newServer);

    // Atualiza o texto do botão pra refletir o servidor atual
    toggleButton.innerText = newServer === 'steam' ? 'LIVE' : 'EVENT';
});

async function getAllStats(id, slots, filtrar) {
    try {
        const teams = await loadTeams();

        //Captura o servidor selecionado no select
        const server = document.getElementById('toggleServer').getAttribute('data-server');

        const apiUrl = `https://api.pubg.com/shards/${server}/matches/${id}`;

        const response = await fetch(apiUrl, options);
        const data = await response.json();

        if (data && data.included && data.included.length > 0 && data.data && data.data.relationships) {
            const rosters = data.data.relationships.rosters.data
                .map(rosterData => {
                    const rosterId = rosterData.id;
                    return data.included.find(item => item.type === 'roster' && item.id === rosterId);
                });

            const rosterResults = [];

            for (const roster of rosters) {
                const participantIds = roster.relationships.participants.data.map(p => p.id);
                const participants = data.included.filter(item => item.type === 'participant' && participantIds.includes(item.id));

                const sumKills = participants.reduce((acc, p) => acc + p.attributes.stats.kills, 0);
                const rank = roster.attributes.stats.rank;
                const teamId = roster.attributes.stats.teamId;
                const isWinner = roster.attributes.won === 'true' ? 1 : 0;
                const placePts = calculatePointsByPosition(rank);
                const totalPoints = sumKills + placePts;
                const teamName = teams[teamId] || 'Nome do Time Desconhecido';

                rosterResults.push({
                    teamId,
                    rank,
                    teamName,
                    isWinner,
                    sumKills,
                    placePts,
                    totalPoints
                });
            }

            // 🔥 Ordenar por totalPoints (desc) e rank (asc)
            rosterResults.sort((a, b) => {
                if (b.totalPoints !== a.totalPoints) {
                    return b.totalPoints - a.totalPoints;
                } else {
                    return a.rank - b.rank;
                }
            });

            // Limpar e renderizar na tabela
            postsContainer.innerHTML = '';

            rosterResults.forEach(result => {
                const row = document.createElement('tr');
                row.classList.add(`${result.teamId}`);
                row.innerHTML = `
                    <td>${result.teamId}</td>
                    <td>${result.rank}</td>
                    <td>${result.teamName}</td>
                    <td>${result.isWinner}</td>
                    <td>${result.placePts}</td>
                    <td>${result.sumKills}</td>
                    <td>${result.totalPoints}</td>
                `;
                postsContainer.appendChild(row);
            });

            document.getElementById('copy-button').classList.remove('hidden');

        } else {
            console.log('Dados ausentes ou inválidos.');
        }
    } catch (error) {
        console.error('Erro ao buscar os dados da API:', error);
    }
}

document.getElementById('searchForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const id = document.getElementById('id').value;

    postsContainer.innerHTML = '';
    document.getElementById('copy-button').classList.add('hidden');

    await getAllStats(id);
});

// Função para calcular os pontos com base na posição (rank) do time
function calculatePointsByPosition(rank) {
    switch (rank) {
        case 1:
            return 10;
        case 2:
            return 6;
        case 3:
            return 5;
        case 4:
            return 4;
        case 5:
            return 3;
        case 6:
            return 2;
        case 7:
        case 8:
            return 1;
        default:
            return 0;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const copyBtn = document.getElementById('copy-button');
    const message = document.getElementById('copy-message');

    copyBtn.addEventListener('click', () => {
        const rows = document.querySelectorAll('#posts-container tr');

        if (rows.length === 0) {
            console.warn('Nenhum dado para copiar.');
            return;
        }

        let textToCopy = '';

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');

            if (cells.length > 0) {
                const teamName = cells[2].innerText;     // Nome do time
                const winner = cells[3].innerText;       // Win (1 ou 0)
                const rank = cells[1].innerText;         // Rank
                const kills = cells[5].innerText;        // Kills
                const totalPoints = cells[6].innerText;  // Total de pontos

                textToCopy += `${teamName}\t${winner}\t${rank}\t${kills}\t${totalPoints}\n`;
            }
        });

        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                message.classList.add('show');
                setTimeout(() => {
                    message.classList.remove('show');
                }, 2000);
            })
            .catch(err => {
                console.error('Erro ao copiar!', err);
            });
    });
});
