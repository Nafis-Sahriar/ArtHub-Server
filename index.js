const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Root Route
app.get("/", (req, res) => {
  res.send("ArtHub Server is running.......");
});

// MongoDB Connection URI
const uri = process.env.MONGO_DB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Database and Collection definition
    const database = client.db("arthubdb");
    const usersCollection = database.collection("user");
    const artCollection = database.collection("artworks"); // Changed to match frontend
    const artPurchaseCollection = database.collection("purchases"); // New collection for purchases
    const planCollection = database.collection("plans"); // New collection for subscription plans
    const subscriptionCollection = database.collection("subscriptions"); // New collection for user subscriptions

    // await client.connect();

    



    // POST: Upload a new artwork
    app.post("/api/artworks", async (req, res) => 
    {
      try 
      {
        const art = req.body;
        const result = await artCollection.insertOne(art);
        res.status(201).json(result);
      } 
      catch (error) 
      {
        console.error("Error inserting artwork:", error);
        res.status(500).json({ error: "Failed to upload artwork" });
      }
    });

    // GET: Fetch all artworks for the public gallery
   
    app.get("/api/artworks", async(req,res)=>{

        const query = {};

        if(req.query.artistId){
            query.artistId = req.query.artistId;
        }
        if(req.query.status)
        {
            query.status = req.query.status;
        }

        const cursor = artCollection.find(query);
        const result = await cursor.toArray();
        res.json(result);

    })

    // GET: Fetch a single artwork by ID
    app.get("/api/artworks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        // Convert the string ID into a MongoDB ObjectId
        const query = { _id: new ObjectId(id) }; 
        const artwork = await artCollection.findOne(query);
        
        if (artwork) {
          res.status(200).json(artwork);
        } else {
          res.status(404).json({ error: "Artwork not found" });
        }
      } catch (error) {
        console.error("Error fetching single artwork:", error);
        res.status(500).json({ error: "Failed to fetch artwork details" });
      }
    });

    // PATCH: Update an existing artwork
    app.patch("/api/artworks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: updatedData
        };

        const result = await artCollection.updateOne(query, updateDoc);
        
        if (result.matchedCount === 1) {
          res.status(200).json({ success: true, message: "Artwork updated successfully" });
        } else {
          res.status(404).json({ success: false, message: "Artwork not found" });
        }
      } catch (error) {
        console.error("Error updating artwork:", error);
        res.status(500).json({ error: "Failed to update artwork" });
      }
    });

    // DELETE: Remove a specific artwork
    app.delete("/api/artworks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        
        // MongoDB requires the ID to be wrapped in ObjectId
        const query = { _id: new ObjectId(id) }; 
        const result = await artCollection.deleteOne(query);
        
        if (result.deletedCount === 1) {
          res.status(200).json({ success: true, message: "Artwork deleted successfully" });
        } else {
          res.status(404).json({ success: false, message: "Artwork not found" });
        }
      } catch (error) {
        console.error("Error deleting artwork:", error);
        res.status(500).json({ error: "Failed to delete artwork" });
      }
    });



    // Artwork Purchase APIs; 

    // app.post("/api/purchases", async (req, res) => {
    //     try {
    //         const purchase = req.body;

            
    //         if (!purchase.artworkId) {
    //             return res.status(400).json({ error: "artworkId is required" });
    //         }

      
    //         const newPurchase = {
    //             ...purchase,
    //             purchaseDate: new Date()
    //         };

       
    //         const purchaseResult = await artPurchaseCollection.insertOne(newPurchase);

  
    //         const updateResult = await artCollection.updateOne(
    //             { _id: new ObjectId(purchase.artworkId) },
    //             { $set: { status: "sold" } }
    //         );

    //         if (updateResult.matchedCount === 0) {
    //             return res.status(404).json({ error: "Artwork not found" });
    //         }

    //         res.status(201).json({ 
    //             success: true, 
    //             purchaseId: purchaseResult.insertedId 
    //         });

    //     } catch (error) {
    //         console.error("Error recording purchase:", error);
    //         res.status(500).json({ error: "Failed to record purchase" });
    //     }
    // });

    app.post("/api/purchases", async (req, res) => {
    try {
        const purchase = req.body;

        if (!purchase.artworkId) {
            return res.status(400).json({ error: "artworkId is required" });
        }

        if (purchase.sessionId) 
            {
            const existingPurchase = await artPurchaseCollection.findOne({ sessionId: purchase.sessionId });
            if (existingPurchase) 
            {
               
                return res.status(200).json({ 
                    success: true, 
                    message: "Purchase already recorded" 
                });
            }
        }
       

        const newPurchase = {
            ...purchase,
            purchaseDate: new Date()
        };

        const purchaseResult = await artPurchaseCollection.insertOne(newPurchase);

        const updateResult = await artCollection.updateOne(
            { _id: new ObjectId(purchase.artworkId) },
            { $set: { status: "sold" } }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ error: "Artwork not found" });
        }

        res.status(201).json({ 
            success: true, 
            purchaseId: purchaseResult.insertedId 
        });

    } catch (error) {
        console.error("Error recording purchase:", error);
        res.status(500).json({ error: "Failed to record purchase" });
    }
});


  

    app.get("/api/purchases", async(req,res)=>{

        const query ={};

        if(req.query.buyerId){
            query.buyerId = req.query.buyerId;
        }

        if(req.query.artistId){
            query.artistId = req.query.artistId;
        }

        const purchases = await artPurchaseCollection.find(query).sort({ purchaseDate: -1 }).toArray();
        res.status(200).json(purchases);

    })


    //plans

    app.get("/api/plans", async(req,res)=>{

        const query = {};
        if(req.query.plan_id){
            query.id = req.query.plan_id;
        }

        const plan = await planCollection.findOne(query);
        res.status(200).json(plan);
    })

    //subscriptions
    app.post("/api/subscriptions", async(req,res)=>{

        const data = req.body;

        console.log("Received subscription data:", data);
        const subsInfo={
            ...data,
            createdAt: new Date()
        }

        const result = await subscriptionCollection.insertOne(subsInfo);

        //update the user plan 

        const filter ={
            email: data.email
        }

        const updateDocument ={
            $set:{
                plan: data.planId,
            }
        }

        const updateResult = await usersCollection.updateOne(filter, updateDocument);


       res.json(updateResult);


    })


  app.get("/api/users", async (req, res) => {
    try {
       
        const result = await usersCollection.find({})
            .project({ password: 0 }) 
            .toArray();
            
        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users from the database." });
    }
});


    app.patch("/api/users/:id", async (req, res) => {
    try {
        const userId = req.params.id;
        const updates = req.body;

       

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: updates }
        );

        res.status(200).json({ 
            success: true, 
            message: "Profile updated successfully",
            modifiedCount: result.modifiedCount
        });

    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ error: "Failed to update profile" });
    }
});











    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } 
  finally 
  {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`ArtHub server listening at http://localhost:${port}`);
});