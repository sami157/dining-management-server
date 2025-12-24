const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { connectMongoDB } = require('./config/connectMongodb');

const app = express()
const port = process.env.PORT || 5000
connectMongoDB()

app.use(cors()); 
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})