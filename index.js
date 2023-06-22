const express = require('express');
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.Payment_Secret_Key)
const app = express()

app.use(cors())
app.use(express.json())

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.kcgiuct.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollection = client.db("CampSportopia").collection("users");
        const classesCollection = client.db("CampSportopia").collection("classes");

        // -------------users------------
        // get users
        app.get('/users', async (req, res) => {
            const role = req.query.role;
            if (role) {
                const query = { role: role }
                const result = await usersCollection.find(query).toArray();
                res.send(result)
            }
            else {
                const result = await usersCollection.find().toArray();
                res.send(result)
            }
        })

        // get one use on email
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            res.send(result)
        })

        // post users
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            console.log(existingUser)
            if (existingUser) {
                return res.send({ message: "user already exists" });
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        // select classes
        app.post('/users/selected/:email', async (req, res) => {
            const email = req.params.email;
            const info = req.body;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            // console.log(info, user);
            const isSelectedHave = user?.selected;
            const isExists = isSelectedHave ? isSelectedHave.find(id => id === info.classId) : false;
            if (isExists) {
                res.send('Already exists');
            }
            else {
                const updateDoc = {
                    $push: { selected: info.classId }
                };
                const result = await usersCollection.updateOne(query, updateDoc);
                res.send(result);
            }
        })

        // Pay classes
        app.post('/users/paid/:email', async (req, res) => {
            const email = req.params.email;
            const info = req.body;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const isPaidHave = user?.enrolled;
            const isExists = isPaidHave ? isPaidHave.find(id => id === info.classId) : false;
            // console.log(isExists);
            if (isExists) {
                res.send('Already enrolled!');
            }
            else {
                const bring = { _id: new ObjectId(info.classId) };
                const enrolled = bring.enrolled+1;
                const updateEnrolled = {
                    $set: {
                        enrolled: enrolled
                    },
                };
                const getIt = await classesCollection.updateOne(bring, updateEnrolled);
                const unpaidClasses = user.selected.filter(id => id !== info.classId)
                // console.log(unpaidClasses)
                const filter = { email: email };
                const updatedDoc = {
                    $set: {
                        selected: unpaidClasses
                    },
                };
                const removed = await usersCollection.updateOne(filter, updatedDoc);
                const updateDoc = {
                    $push: { enrolled: info.classId }
                };
                const result = await usersCollection.updateOne(query, updateDoc);
                res.send(result);
            }
        })

        // update user to admin
        app.patch('/users/admin', async (req, res) => {
            const id = req.query.id;
            const role = req.query.role;
            // console.log(id, role)
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: role
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        // -------------------classes----------------
        // get classes
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result)
        })

        // get selected classes
        app.get('/classes/selected/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const options = {
                projection: { _id: 0, selected: 1 },
            };
            const { selected } = await usersCollection.findOne(query, options);
            // console.log(selected)
            const newSelected = selected.map(item => new ObjectId(`${item}`));
            // console.log(newSelected); 
            const result = await classesCollection.find({ _id: { $in: newSelected } }).toArray();
            res.send(result)
        })

        // get enrolled classes
        app.get('/classes/enrolled/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const options = {
                projection: { _id: 0, enrolled: 1 },
            };
            const { enrolled } = await usersCollection.findOne(query, options);
            // console.log(selected)
            const newEnrolled = enrolled.map(item => new ObjectId(`${item}`));
            // console.log(newSelected); 
            const result = await classesCollection.find({ _id: { $in: newEnrolled } }).toArray();
            res.send(result)
        })

        // get class
        app.get('/classes/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const query = { _id: new ObjectId(id) }
            const result = await classesCollection.findOne(query);
            res.send(result);
        })

        // post classes
        app.post('/classes', async (req, res) => {
            const cls = req.body;
            // console.log(cls)
            const result = await classesCollection.insertOne(cls);
            res.send(result)
        })

        // delete selected class
        app.post('/classes/delete/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const options = {
                projection: { _id: 0, selected: 1 },
            };
            const { selected } = await usersCollection.findOne(query, options);
            const toDelete = req.body.classId
            // console.log(toDelete, selected)
            const undeletedClasses = selected.filter(id => id !== toDelete)
            // console.log(unpaidClasses)
            const filter = { email: email };
            const updatedDoc = {
                $set: {
                    selected: undeletedClasses
                },
            };
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        // update classes to approve or denie
        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const newMessage = req.body;
            // console.log(id, newMessage)
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: newMessage.newStatus,
                    message: newMessage.adminMessage
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        // update classes by instructor
        app.patch('/classes/update/:id', async (req, res) => {
            const id = req.params.id;
            const updatedClass = req.body;
            console.log(id, updatedClass)
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    imglink: updatedClass.imglink,
                    totalSeat: updatedClass.totalSeat,
                    price: updatedClass.price,
                    status: 'pending'
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        // create payment intent
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            // console.log(amount)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send("server is running")
})

app.listen(port, () => {
    console.log('running on', port)
})