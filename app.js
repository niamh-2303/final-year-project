const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public')); // Serve static files

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/html/index.html');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});