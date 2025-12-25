const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { connectMongoDB } = require('./config/connectMongodb');
const managersRouter = require('./modules/managers/managers.route');

const app = express()
const port = process.env.PORT || 5000
connectMongoDB()

app.use(cors()); 
app.use(express.json());

app.use('/managers', managersRouter);

app.get('/', (req, res) => {
  res.send('Welcome to dining management server')
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})