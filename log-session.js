// Helper script to log sessions from command line or Eve's context
// Usage: Include this script or copy logSession function

function logSession(data) {
    // data = { model, task, tokensIn, tokensOut, cost, sessionKey }
    if (typeof DataStore === 'undefined') {
        console.error('DataStore not loaded. Include data.js first.');
        return;
    }
    
    DataStore.logSession(data);
    console.log(`✓ Logged session: ${data.model} for ${data.task || 'general'} - $${(data.cost || 0).toFixed(3)}`);
}

// Example usage:
// logSession({
//     model: 'sonnet',
//     task: 'Build Mission Control',
//     tokensIn: 52242,
//     tokensOut: 2500,
//     cost: 0.45,
//     sessionKey: 'agent:main:main'
// });

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { logSession };
}
