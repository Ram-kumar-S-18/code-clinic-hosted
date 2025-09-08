// --- Code-Clinic Serverless Function ---
// This code runs in the cloud on Netlify.
const Ably = require('ably');

exports.handler = async function (event, context) {
    const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });
    const channel = ably.channels.get('code-clinic-event');
    let stateChanged = false;

    // Helper to get the most recent state from Ably History
    const getLatestState = async () => {
        const history = await channel.history({ limit: 1, direction: 'backwards' });
        if (history.items.length > 0 && history.items[0].name === 'stateUpdate') {
            return history.items[0].data;
        }
        return createInitialState(); // Return a fresh state if no history exists
    };

    const { type, payload, senderId } = JSON.parse(event.body);
    let eventState = await getLatestState();

    // --- All the game logic is here ---
    switch (type) {
        case 'requestState':
            // A new client is asking for the current state.
            // We don't change the state, just publish the current one.
            break; // We'll publish the state at the end.

        case 'initializeEvent':
            if (!eventState.isInitialized) {
                eventState = createInitialState();
                eventState.isInitialized = true;
                stateChanged = true;
            }
            break;
        
        case 'joinOrCreateTeam': {
            const { teamId, teamName, userName } = payload;
            if (eventState.teams[teamId]) {
                if (!eventState.teams[teamId].members.some(m => m.userId === senderId)) {
                    eventState.teams[teamId].members.push({ userId: senderId, userName });
                    stateChanged = true;
                }
            } else {
                eventState.teams[teamId] = { id: teamId, name: teamName, members: [{ userId: senderId, userName }], currentQuestionIndex: 0, finishedMembers: [], round: 1, finishTimes: {} };
                stateChanged = true;
            }
            break;
        }
        // ... other cases (finishQuestion, updateQuestions, timerControl) are the same
    }
    
    // Always publish the latest state in response to any action
    await channel.publish('stateUpdate', eventState);

    return {
        statusCode: 200,
        body: JSON.stringify({ status: 'success' })
    };
};

function createInitialState() {
    return {
        isInitialized: false,
        round: 1,
        timerRunning: false,
        startTime: null,
        pauseTime: null,
        round1Questions: [
            { title: "The Grade Averager", content: "..." },
            // ... all 15 questions from the PDF
        ],
        round2Questions: [],
        teams: {}
    };
}

