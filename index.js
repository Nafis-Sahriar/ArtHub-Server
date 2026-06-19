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
    const artCollection = database.collection("artworks"); // Changed to match frontend
    const artPurchaseCollection = database.collection("purchases"); // New collection for purchases

    await client.connect();




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



    // POST: Record a new purchase
    // POST: Record a new purchase and update artwork status
    app.post("/api/purchases", async (req, res) => {
        try {
            const purchase = req.body;

            // 1. Validate that we have the artworkId
            if (!purchase.artworkId) {
                return res.status(400).json({ error: "artworkId is required" });
            }

            // 2. Prepare the purchase record
            const newPurchase = {
                ...purchase,
                purchaseDate: new Date()
            };

            // 3. Insert into the purchases collection
            const purchaseResult = await artPurchaseCollection.insertOne(newPurchase);

            // 4. Update the artwork status to 'sold'
            // Using the same ObjectId pattern you used in your delete endpoint
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