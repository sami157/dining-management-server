const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { connectMongoDB } = require('./config/connectMongodb');
const managersRouter = require('./modules/managers/managers.route');
const usersRouter = require('./modules/users/users.route');
const financeRouter = require('./modules/finance/finance.routes');

const app = express()
const port = process.env.PORT || 5000

app.use(cors());
app.use(express.json());

app.use('/managers', managersRouter);
app.use('/users', usersRouter);
app.use('/finance', financeRouter);

app.get('/', (req, res) => {
  res.send('Welcome to dining management server')
})

connectMongoDB().then(() => {
  app.listen(port, () => {
    // console.log(`Server running on port ${port}`)
  })
})