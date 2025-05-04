const express = require('express');
const path = require('path');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection URI
// Replace with your MongoDB Atlas connection string or use environment variable
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'digitSpan';
const COLLECTION_NAME = 'results';

// MongoDB client
const client = new MongoClient(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ssl: true,
    tls: true,
    tlsAllowInvalidCertificates: false,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..'))); // Serve files from parent directory

// Connect to MongoDB
// Update your connectToMongoDB function
async function connectToMongoDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        // Test the connection with a simple query
        const database = client.db(DB_NAME);
        await database.command({ ping: 1 });
        console.log("MongoDB connection verified with ping");
        
        return true;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        
        // Log more detailed error information
        if (error.name === 'MongoServerSelectionError') {
            console.error('Could not select MongoDB server. Check your connection string and network settings.');
        }
        
        return false;
    }
}

// Initialize DB connection
connectToMongoDB();

// Endpoint to save results
app.post('/api/save-result', async (req, res) => {
    const { taskId, score, timestamp = new Date().toISOString() } = req.body;
    
    if (!taskId || score === undefined) {
        return res.status(400).json({ error: 'Missing required fields: taskId and score' });
    }
    
    try {
        const database = client.db(DB_NAME);
        const collection = database.collection(COLLECTION_NAME);
        
        // Insert the result
        await collection.insertOne({ taskId, score, timestamp });
        
        console.log(`Saved result: ${taskId}, ${score}, ${timestamp}`);
        res.status(200).json({ success: true, message: 'Result saved successfully' });
    } catch (error) {
        console.error('Error saving result:', error);
        res.status(500).json({ error: 'Failed to save result' });
    }
});

// Admin endpoint to view results
app.get('/admin', async (req, res) => {
    // Simple password protection
    const password = req.query.password;
    if (password !== 'psychPdigit123') { // Change this to a secure password
        return res.status(401).send('Unauthorized');
    }

    try {
        const database = client.db(DB_NAME);
        const collection = database.collection(COLLECTION_NAME);
        
        // Get all results sorted by timestamp (newest first)
        const results = await collection.find({}).sort({ timestamp: -1 }).toArray();
        
        // Generate CSV content
        let csvContent = 'taskId,score,timestamp\n';
        results.forEach(result => {
            csvContent += `${result.taskId},${result.score},${result.timestamp}\n`;
        });
        
        // Create table rows for HTML display
        const tableRows = results.map(result => `
            <tr>
                <td>${result.taskId}</td>
                <td>${result.score}</td>
                <td>${result.timestamp}</td>
            </tr>
        `).join('');
        
        // Send HTML page with results
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Digit Span Task Results</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .download-btn { 
                        background-color: #4CAF50; 
                        color: white; 
                        padding: 10px 15px; 
                        border: none; 
                        border-radius: 4px; 
                        cursor: pointer; 
                        margin-bottom: 20px; 
                    }
                    h1 { margin-bottom: 20px; }
                    .no-results {
                        text-align: center;
                        padding: 20px;
                        color: #777;
                        font-style: italic;
                    }
                </style>
            </head>
            <body>
                <h1>Digit Span Task Results</h1>
                
                ${results.length > 0 ? `
                <button class="download-btn" onclick="downloadCSV()">Download CSV</button>
                <table>
                    <thead>
                        <tr>
                            <th>Task ID</th>
                            <th>Score</th>
                            <th>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                ` : '<div class="no-results">No results found</div>'}

                <script>
                    function downloadCSV() {
                        const csvContent = \`${csvContent}\`;
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'digit_span_results.csv';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error retrieving results:', error);
        res.status(500).send('Error retrieving results from database');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Handle process termination
process.on('SIGINT', async () => {
    try {
        await client.close();
        console.log('MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error closing MongoDB connection:', error);
        process.exit(1);
    }
});