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
    const commentsCollection = database.collection("comments"); 

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
   
// app.get("/api/artworks", async(req,res)=>{

//         const query = {};

//         if(req.query.artistId){
//             query.artistId = req.query.artistId;
//         }
//         if(req.query.status)
//         {
//             query.status = req.query.status;
//         }

//         const cursor = artCollection.find(query);
//         const result = await cursor.toArray();
//         res.json(result);

//     });



app.get("/api/artworks", async (req, res) => {
    try {
        const query = {};

        if (req.query.artistId) query.artistId = req.query.artistId;
        if (req.query.status) query.status = req.query.status;

        if (req.query.search) {
            query.$or = [
                { title: { $regex: req.query.search, $options: 'i' } },
                { artistName: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        if (req.query.category && req.query.category !== 'all') {
            query.category = req.query.category;
        }

        let sortOption = { createdAt: -1 }; 
        if (req.query.sort === 'price_low') sortOption = { price: 1 };
        if (req.query.sort === 'price_high') sortOption = { price: -1 };

        //pagination related 
       if (req.query.page) {
         
            const page = parseInt(req.query.page) || 1;
            const perPage = parseInt(req.query.perPage) || 3; 

            const skip = (page - 1) * perPage;

            const total = await artCollection.countDocuments({
                status: "available",
            });

            const cursor = artCollection.find(query).sort(sortOption).skip(skip).limit(perPage);
            const results = await cursor.toArray();
            
            return res.status(200).json({results, total});
        }
     
        const cursor = artCollection.find(query).sort(sortOption);
        const results = await cursor.toArray();
        
        res.status(200).json(results);

    } catch (error) {
        console.error("Error fetching artworks:", error);
        res.status(500).json({ error: "Failed to fetch artworks" });
    }
});

    
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

  
    app.delete("/api/artworks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        
        
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

    app.get("/api/subscriptions", async (req, res) => {
    try {
        const subscriptions = await subscriptionCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.status(200).json(subscriptions);
    } catch (error) {
        console.error("Error fetching subscriptions:", error);
        res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
});


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
        const updates = {
            name: req.body.name,
            image:req.body.imageUrl
        }
        
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

//comments section

// POST a new comment
app.post("/api/comments", async (req, res) => {
    try {
        const { artworkId, userId, userName, userImageUrl, comment } = req.body;

        const newComment = {
            artworkId,
            userId,
            userName,
            userImageUrl,
            comment,
            createdAt: new Date().toISOString() // Standardized date format
        };

        const result = await commentsCollection.insertOne(newComment);
        
        // Return the full comment back to the frontend so we can display it instantly
        res.status(201).json({ ...newComment, _id: result.insertedId });
    } catch (error) {
        console.error("Error posting comment:", error);
        res.status(500).json({ error: "Failed to post comment" });
    }
});

// GET comments for a specific artwork
app.get("/api/comments/:artworkId", async (req, res) => {
    try {
        const { artworkId } = req.params;
        // Fetch comments and sort by newest first
        const cursor = commentsCollection.find({ artworkId }).sort({ createdAt: -1 });
        const comments = await cursor.toArray();
        
        res.status(200).json(comments);
    } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ error: "Failed to fetch comments" });
    }
});

// PUT (Edit) an existing comment
app.put("/api/comments/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { comment, userId } = req.body;

        // Security check: Find the comment first to ensure the user owns it
        const existingComment = await commentsCollection.findOne({ _id: new ObjectId(id) });
        
        if (!existingComment) {
            return res.status(404).json({ error: "Comment not found" });
        }
        if (existingComment.userId !== userId) {
            return res.status(403).json({ error: "Unauthorized to edit this comment" });
        }

        const result = await commentsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { comment: comment, isEdited: true } }
        );

        res.status(200).json({ message: "Comment updated successfully" });
    } catch (error) {
        console.error("Error updating comment:", error);
        res.status(500).json({ error: "Failed to update comment" });
    }
});

// DELETE a comment
app.delete("/api/comments/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body; // Pass userId in body to verify ownership

        const existingComment = await commentsCollection.findOne({ _id: new ObjectId(id) });
        
        if (!existingComment) {
            return res.status(404).json({ error: "Comment not found" });
        }
        if (existingComment.userId !== userId) {
            return res.status(403).json({ error: "Unauthorized to delete this comment" });
        }

        await commentsCollection.deleteOne({ _id: new ObjectId(id) });
        res.status(200).json({ message: "Comment deleted successfully" });
    } catch (error) {
        console.error("Error deleting comment:", error);
        res.status(500).json({ error: "Failed to delete comment" });
    }
});




// admin stats aggregation apis

//user stats api.
app.get("/api/admin/stats/users", async (req, res) => {
    try {
        const totalUsers = await usersCollection.countDocuments({}); 
        const totalArtists = await usersCollection.countDocuments({ role: "artist" });
        const totalBuyers = await usersCollection.countDocuments({ role: { $nin: ["artist", "admin"] } });
        
        // Return all three
        res.status(200).json({ totalUsers, totalArtists, totalBuyers });
    } catch (error) {
        console.error("Error fetching user stats:", error);
        res.status(500).json({ error: "Failed to fetch user stats" });
    }
});


app.get("/api/admin/stats/artworks", async (req, res) => {
    try {
        const pipeline = [
            { 
                $group: { 
                    _id: { $ifNull: ["$category", "Uncategorized"] }, 
                    count: { $sum: 1 } 
                } 
            },
            { 
                $project: { 
                    name: "$_id", 
                    value: "$count", 
                    _id: 0 
                } 
            }
        ];
        
        const pieChartData = await artCollection.aggregate(pipeline).toArray();
        res.status(200).json(pieChartData);
    } catch (error) {
        console.error("Error fetching artwork stats:", error);
        res.status(500).json({ error: "Failed to fetch artwork stats" });
    }
});

app.get("/api/admin/stats/category-sales", async (req, res) => {
    try {
        const pipeline = [
            {
               
                $group: {
                    _id: { $ifNull: ["$category", "Uncategorized"] }, 
                    totalRevenue: { $sum: "$price" },                 
                    itemsSold: { $sum: 1 }                            
                }
            },
            {
                
                $project: {
                    name: "$_id",
                    value: "$totalRevenue", 
                    itemsSold: 1,
                    _id: 0
                }
            },
            { 
               
                $sort: { value: -1 } 
            }
        ];
        
    
        const categorySalesData = await artPurchaseCollection.aggregate(pipeline).toArray();
        
        res.status(200).json(categorySalesData);
        
    } catch (error) {
        console.error("Error fetching category sales:", error);
        res.status(500).json({ error: "Failed to fetch category sales data" });
    }
});


app.get("/api/admin/stats/subscriptions", async (req, res) => {
    try {
        const pipeline = [
            {
                $group: {
                    _id: null,
                    totalSubRevenue: {
                        $sum: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$planId", "buyer_premium"] }, then: 19.99 },
                                    { case: { $eq: ["$planId", "buyer_pro"] }, then: 9.99 }
                                ],
                                default: 0 
                            }
                        }
                    }
                }
            }
        ];
        const result = await subscriptionCollection.aggregate(pipeline).toArray();
        const totalSubscriptionRevenue = result.length > 0 ? result[0].totalSubRevenue : 0;
        
        res.status(200).json({ totalSubscriptionRevenue });
    } catch (error) {
        console.error("Error fetching subscription stats:", error);
        res.status(500).json({ error: "Failed to fetch subscription stats" });
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