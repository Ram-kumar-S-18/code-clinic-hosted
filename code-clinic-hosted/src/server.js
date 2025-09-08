// --- Code-Clinic WebSocket Server (for Hosting) ---

const WebSocket = require('ws');

// **MODIFICATION FOR HOSTING**
// Use the port provided by the hosting service (like Render), or default to 8080 for local testing.
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let eventState = {
    isInitialized: false,
    round: 1,
    timerRunning: false,
    startTime: null, 
    pauseTime: null,
    round1Questions: [
        { title: "Infinite Loop", content: `def calculate_average_grade(grades):\n    """Calculates the average of a list of grades."""\n    if not grades:\n        return 0\n    total = sum(grades)\n    # Error: Uses a fixed number (10) instead of the actual list length\n    average = total / 10\n    return average` },
        { title: "Off-by-One Error", content: `def get_final_price(price):\n    """Calculates final price with incorrect discount logic."""\n    final_price = float(price)\n    if final_price > 50:\n        final_price *= 0.9\n    if final_price > 100:\n        final_price *= 0.8\n    return round(final_price, 2)` },
        { title: "Null Pointer Exception", content: `def is_in_range(number, min_val, max_val):\n    """Checks if a number is between min and max, inclusively."""\n    return number > min_val and number < max_val`},
        { title: "Incorrect API Endpoint", content: `def get_welcome_message(user_dict, is_logged_in):\n    if user_dict:\n        return f"Welcome, {user_dict['name']}!"\n    else:\n        return "Welcome, Guest!"`},
        { title: "CSS Z-Index Issue", content: `def count_odd_numbers(numbers):\n    count = 0\n    for num in numbers:\n        count += 1\n    return count`},
    ],
    round2Questions: [],
    teams: {} 
};

// --- Helper Functions ---
function broadcastState() {
    const stateString = JSON.stringify({ type: 'stateUpdate', payload: eventState });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(stateString);
        }
    });
    console.log(`[Broadcast] Sent updated state to ${wss.clients.size} clients.`);
}

function getElapsedTime() {
    if (!eventState.startTime) return 0;
    const start = new Date(eventState.startTime).getTime();
    if (!eventState.timerRunning) {
        const pause = eventState.pauseTime ? new Date(eventState.pauseTime).getTime() : start;
        return pause - start;
    }
    return Date.now() - start;
}

wss.on('connection', ws => {
    console.log('[Connection] A new client connected.');
    ws.send(JSON.stringify({ type: 'stateUpdate', payload: eventState }));

    ws.on('message', message => {
        let stateChanged = false;
        try {
            const { type, payload } = JSON.parse(message);
            console.log(`[Message] Received action of type: ${type}`);

            switch (type) {
                case 'initializeEvent':
                    if (!eventState.isInitialized) {
                        eventState.isInitialized = true;
                        stateChanged = true;
                    }
                    break;
                
                case 'joinOrCreateTeam': {
                    const { teamId, teamName, userName, userId } = payload;
                    if (eventState.teams[teamId]) {
                        if (!eventState.teams[teamId].members.some(m => m.userId === userId)) {
                            eventState.teams[teamId].members.push({ userId, userName });
                            stateChanged = true;
                        }
                    } else {
                        eventState.teams[teamId] = {
                            id: teamId, name: teamName, members: [{ userId, userName }],
                            currentQuestionIndex: 0, finishedMembers: [], round: 1, finishTimes: {}
                        };
                        stateChanged = true;
                    }
                    break;
                }

                case 'finishQuestion': {
                    const { teamId, userId } = payload;
                    const team = eventState.teams[teamId];
                    if (team && !team.finishedMembers.includes(userId)) {
                        team.finishedMembers.push(userId);
                        if (team.finishedMembers.length === team.members.length) {
                             const questions = eventState.round === 1 ? eventState.round1Questions : eventState.round2Questions;
                             if(team.currentQuestionIndex < questions.length) {
                                 team.finishTimes[`q${team.currentQuestionIndex}`] = getElapsedTime();
                                 team.currentQuestionIndex++;
                                 team.finishedMembers = [];
                             }
                        }
                        stateChanged = true;
                    }
                    break;
                }
                
                case 'updateQuestions': {
                    eventState.round1Questions = payload.round1Questions || [];
                    eventState.round2Questions = payload.round2Questions || [];
                    stateChanged = true;
                    break;
                }

                case 'timerControl': {
                    const { action } = payload;
                    if (action === 'start') {
                        eventState.timerRunning = true;
                        const previouslyElapsed = getElapsedTime();
                        eventState.startTime = new Date(Date.now() - previouslyElapsed).toISOString();
                        eventState.pauseTime = null;
                    } else if (action === 'pause') {
                        eventState.timerRunning = false;
                        eventState.pauseTime = new Date().toISOString();
                    } else if (action === 'reset') {
                        eventState.timerRunning = false;
                        eventState.startTime = null;
                        eventState.pauseTime = null;
                        Object.values(eventState.teams).forEach(team => {
                            team.currentQuestionIndex = 0;
                            team.finishedMembers = [];
                            team.finishTimes = {};
                        });
                    }
                    stateChanged = true;
                    break;
                }
            }

            if (stateChanged) {
                broadcastState();
            }

        } catch (error) {
            console.error('[Error] Failed to process message:', error);
        }
    });

    ws.on('close', () => {
        console.log('[Connection] A client disconnected.');
    });
});

console.log('--- Code-Clinic Real-time Server ---');
console.log(`Server is running on port ${PORT}`);
console.log('Waiting for connections...');
