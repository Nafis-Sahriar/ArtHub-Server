const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

const app = express();
const port = process.env.PORT || 5000;


app.use(express.json());
app.use(cors());


app.get("/", (req, res) => {
  res.send("ArtHub Server is running.......");
});


const uri = process.env.MONGO_DB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

    const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

    const verifyToken = async(req,res, next)=>{

        const authHeader = req.headers.authorization;

        // console.log("Authorization Header:", authHeader); 

        if(!authHeader || !authHeader.startsWith("Bearer ")){
            return res.status(401).json({error: "Unauthorized access"});
        }

        const token = authHeader.split(" ")[1];

        if(!token){
            return res.status(401).json({error: "Unauthorized access"});
        }

        try{
            const {payload} = await jwtVerify(token, JWKS);
            // console.log(payload);

            req.user = payload;

            next();
        }
        catch(error)
        {
            console.error("Token verification failed:", error);
            return res.status(401).json({error: "Unauthorized access"});
        }



    }

    const verifyArtist = async(req,res,next)=>{

        // console.log(req);

         // console.log("Verifying artist role for user:", req.user); 
        const user = req.user;
        if(user.role !== "artist"){
            return res.status(403).json({error: "Forbidden: Artist access only"});
        }
        next();
    }

    const verifyAdmin = async(req,res,next)=>{
        const user = req.user;
        if(user.role !== "admin"){
            return res.status(403).json({error: "Forbidden: Admin access only"});
        }
        next();
    }


async function run() {
  try {
    
    const database = client.db("arthubdb");
    const usersCollection = database.collection("user");
    const artCollection = database.collection("artworks"); 
    const artPurchaseCollection = database.collection("purchases"); 
    const planCollection = database.collection("plans"); 
    const subscriptionCollection = database.collection("subscriptions"); 
    const commentsCollection = database.collection("comments"); 
    const supportTicketsCollection = database.collection("support");

    // For Community Forum
    const communityPostCollection = database.collection("community_posts");
    const communityCommentCollection = database.collection("community_comments");

    // for wishlist

    const wishlistCollection = database.collection("wishlists");

    // await client.connect();

    



    // POST: Upload a new artwork
    app.post("/api/artworks", verifyToken, verifyArtist,  async (req, res) => 
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

                if (req.query.minPrice || req.query.maxPrice) {
                    query.price = {};

                    if (req.query.minPrice) {
                        query.price.$gte = Number(req.query.minPrice); 
                    }

                    if (req.query.maxPrice) {
                        query.price.$lte = Number(req.query.maxPrice);
                    }
                }

                
                let sortOption = { status: 1, createdAt: -1 }; 
                if (req.query.sort === 'price_low') sortOption = { status: 1, price: 1 };
                if (req.query.sort === 'price_high') sortOption = { status: 1, price: -1 };

              
                if (req.query.page) {
                    const page = parseInt(req.query.page) || 1;
                    const perPage = parseInt(req.query.perPage) || 3; 
                    const skip = (page - 1) * perPage;

                    const total = await artCollection.countDocuments(query); 

                    const cursor = artCollection.find(query).sort(sortOption).skip(skip).limit(perPage);
                    const results = await cursor.toArray();
                    
                    return res.status(200).json({ results, total });
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


    app.patch("/api/artworks/:id",verifyToken, async (req, res) => {
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

  
    app.delete("/api/artworks/:id",verifyToken, async (req, res) => {

        // jehetu admin + artist duijon e delete korbe, tai sudhu verifyToken use korlam apatoto, pore admin er 
        // alada api banabo.
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

    // for featured section and homepage, these are public , no need to verify Token.
   
app.get("/api/featuredArtworks", async (req, res) => {
    try {
      
        const pipeline = [
        
            { $match: { status: 'available' } },
            
          
            { $sample: { size: 6 } }
        ];

      
        const cursor = artCollection.aggregate(pipeline);
        const featuredArtworks = await cursor.toArray();
        
        res.status(200).json(featuredArtworks);
    } catch (error) {
        console.error("Error fetching featured artworks:", error);
        res.status(500).json({ error: "Failed to fetch featured artworks" });
    }
});


app.get("/api/top-artists", async (req, res) => {
    try {
        const pipeline = [
         
            {
                $group: {
                    _id: "$artistId",
                    totalSales: { $sum: 1 } 
                }
            },
         
            { $sort: { totalSales: -1 } },
            
            { $limit: 3 },
            
       
            {
                $addFields: {
                    artistObjectId: { $toObjectId: "$_id" }
                }
            },
            
            {
                $lookup: {
                    from: "user", 
                    localField: "artistObjectId",
                    foreignField: "_id",
                    as: "artistDetails"
                }
            },
            
          
            { $unwind: "$artistDetails" },
            
        
            {
                $project: {
                    _id: 0,
                    artistId: "$_id",
                    name: "$artistDetails.name",
                    imageUrl: "$artistDetails.image",
                    totalSales: 1
                }
            }
        ];

        
        const topArtists = await artPurchaseCollection.aggregate(pipeline).toArray();
        
        res.status(200).json(topArtists);

    } catch (error) {
        console.error("Error fetching top artists:", error);
        res.status(500).json({ error: "Failed to fetch top artists" });
    }
});


app.get("/api/most-expensive-art", async (req, res) => {
    try {
        
        const mostExpensiveArray = await artCollection
            .find({ status: 'available' }) 
            .sort({ price: -1 }) 
            .limit(1)
            .toArray();

     
        if (mostExpensiveArray.length === 0) {
            return res.status(404).json({ message: "No artworks found." });
        }

      
        res.status(200).json(mostExpensiveArray[0]);

    } catch (error) {
        console.error("Error fetching most expensive art:", error);
        res.status(500).json({ error: "Failed to fetch most expensive art" });
    }
});


  

    app.post("/api/purchases",verifyToken,  async (req, res) => {
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



    app.get("/api/purchases",verifyToken, async(req,res)=>{

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


    //plans and Subscription Related APIs

    app.get("/api/plans", verifyToken, async(req,res)=>{

        const query = {};
        if(req.query.plan_id){
            query.id = req.query.plan_id;
        }

        const plan = await planCollection.findOne(query);
        res.status(200).json(plan);
    })

    //subscriptions
    app.post("/api/subscriptions", verifyToken, async(req,res)=>{

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

    app.get("/api/subscriptions",verifyToken,  async (req, res) => {
    try {
        const subscriptions = await subscriptionCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.status(200).json(subscriptions);
    } catch (error) {
        console.error("Error fetching subscriptions:", error);
        res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
});


  app.get("/api/users", verifyToken, verifyAdmin, async (req, res) => {
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
        
        // 1. Create an empty object to hold our dynamic updates
        const updates = {};

        // 2. Only add fields to the update object if they exist in the request body
        if (req.body.name) updates.name = req.body.name;
        if (req.body.imageUrl) updates.image = req.body.imageUrl;
        if (req.body.role) updates.role = req.body.role; // <-- THIS FIXES YOUR ROLE ISSUE

        // Optional safety check: Ensure we actually have something to update
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: "No valid fields provided for update" });
        }

        console.log("Applying updates to DB:", updates); // Debugging log

        // 3. Apply the updates to the database
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: updates }
        );

        res.status(200).json({ 
            success: true, 
            message: "User updated successfully",
            modifiedCount: result.modifiedCount
        });

    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Failed to update user" });
    }
});




//comments section


app.post("/api/comments", verifyToken, async (req, res) => {
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


app.get("/api/comments/:artworkId", async (req, res) => {
    try {
        const { artworkId } = req.params;

        const cursor = commentsCollection.find({ artworkId }).sort({ createdAt: -1 });
        const comments = await cursor.toArray();
        
        res.status(200).json(comments);
    } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ error: "Failed to fetch comments" });
    }
});


app.put("/api/comments/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { comment, userId } = req.body;

       
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


app.delete("/api/comments/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body; 

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


app.get("/api/admin/stats/users",verifyToken, verifyAdmin,  async (req, res) => {
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


app.get("/api/admin/stats/artworks",verifyToken, verifyAdmin,  async (req, res) => {
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

app.get("/api/admin/stats/category-sales",verifyToken, verifyAdmin,  async (req, res) => {
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


app.get("/api/admin/stats/subscriptions",verifyToken, verifyAdmin, async (req, res) => {
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



// extra feature - 1  I will implement a support ticket system both for user and artist here.

app.post("/api/support",verifyToken, async (req, res) => {
    try {
        const ticketData = req.body;
        
       
        ticketData.createdAt = new Date().toISOString();
        ticketData.status = "pending"; 
        
        const result = await supportTicketsCollection.insertOne(ticketData);
        res.status(201).json({ success: true, insertedId: result.insertedId });
    } catch (error) {
        console.error("Error creating support ticket:", error);
        res.status(500).json({ success: false, message: "Failed to create support ticket." });
    }
});


app.get("/api/support/:email",verifyToken, async (req, res) => {
    try {

        const email = req.params.email;

        const tickets = await supportTicketsCollection.find({ email: email }).sort({ createdAt: -1 }).toArray();
        res.status(200).json(tickets);
    } catch (error) {
        console.error("Error fetching tickets:", error);
        res.status(500).json({ error: "Failed to fetch tickets." });
    }
});

// support handling by admin

// this api will be used by admin to fetch all the support ticket.

app.get("/api/support/admin/all",verifyToken, verifyAdmin, async (req, res) => {
    try {
        
        const tickets = await supportTicketsCollection
            .find()
            .sort({ status: 1, createdAt: -1 })
            .toArray();
            
        res.status(200).json(tickets);
    } catch (error) {
        console.error("Error fetching all tickets:", error);
        res.status(500).json({ error: "Failed to fetch tickets." });
    }
});

// this api will be used by admin to update the status.

app.patch("/api/support/:id",verifyToken, verifyAdmin, async (req, res) => {
    try {
        const ticketId = req.params.id;
        const { status } = req.body;

        const filter = { _id: new ObjectId(ticketId) };
        const updateDoc = {
            $set: { 
                status: status,
                resolvedAt: status === "resolved" ? new Date().toISOString() : null 
            }
        };
        const result = await supportTicketsCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount > 0) {
            res.status(200).json({ success: true, message: "Ticket updated successfully" });
        } else {
            res.status(404).json({ success: false, message: "Ticket not found or status unchanged" });
        }
    } catch (error) {
        console.error("Error updating ticket:", error);
        res.status(500).json({ success: false, error: "Failed to update ticket status." });
    }
});


// wishlist APIs




// extra Feature - 2 - I will implement A Community Forum where users and artists can discuss and share ideas.

// APIs I will need,
//1. GET ALL POSTS (Global Feed)
//2. CREATE A NEW POST
//3. GET COMMENTS FOR A SPECIFIC POST
//4. ADD A COMMENT TO A SPECIFIC POST
//5. DELETE A POST
// 6. LIKE/UNLIKE A POST , ekta patch lagbe.





app.get("/api/community/posts", async (req, res) => {
    try 
    {
        
        const posts = await communityPostCollection.find().sort({ createdAt: -1 }).toArray();
        res.status(200).json(posts);

    } 

    catch (error) 
    {

        console.error("Error fetching community posts:", error);
        res.status(500).json({ error: "Failed to fetch posts." });
    }
});


app.post("/api/community/posts", async (req, res) => {
    try {
        const postData = req.body;
        
        
        postData.createdAt = new Date().toISOString();
        postData.likes = []; 
        
        const result = await communityPostCollection.insertOne(postData);
        res.status(201).json({ success: true, insertedId: result.insertedId });
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ success: false, message: "Failed to create post." });
    }
});


app.get("/api/community/posts/:postId/comments", async (req, res) => {
    try {
        const { postId } = req.params;
        
        
        const comments = await communityCommentCollection
            .find({ postId: postId })
            .sort({ createdAt: 1 }) 
            .toArray();
            
        res.status(200).json(comments);
    } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ error: "Failed to fetch comments." });
    }
});


app.post("/api/community/posts/:postId/comments", async (req, res) => {
    try {
        const commentData = req.body;
        
        
        commentData.createdAt = new Date().toISOString();
        commentData.postId = req.params.postId; 
        
        const result = await communityCommentCollection.insertOne(commentData);
        res.status(201).json({ success: true, insertedId:result.insertedId });

    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).json({ success: false, message: "Failed to add comment." });
    }
});


app.delete("/api/community/posts/:postId", async (req, res) => {
    try {
        const { postId } = req.params;
        const filter = { _id: new ObjectId(postId) };
        
       
        const deletePostResult = await communityPostCollection.deleteOne(filter);
        
        if (deletePostResult.deletedCount > 0) 
        {
           // sob comments delete kore dibo. have to use deletemany.

            await communityCommentCollection.deleteMany({ postId: postId });

            res.status(200).json({ success: true, message: "Post and associated comments deleted." });
        } else {
            res.status(404).json({ success: false, message: "Post not found." });
        }
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).json({ success: false, error: "Failed to delete post." });
    }
});


app.patch("/api/community/posts/:postId/like", async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body; 

        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID required" });
        }

        const filter = { _id: new ObjectId(postId) };
        const post = await communityPostCollection.findOne(filter);
        
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        const likesArray = post.likes || []; 

        const hasLiked = likesArray.includes(userId);
        const updateDoc = hasLiked 
            ? { $pull: { likes: userId } } 
            : { $push: { likes: userId } };

        await communityPostCollection.updateOne(filter, updateDoc);

        res.status(200).json({ success: true, isLiked: !hasLiked });
    } catch (error) {
        console.error("Error toggling like:", error);
        res.status(500).json({ success: false, error: "Failed to update like status." });
    }
});

// Wishlist APIs

app.post("/api/wishlist/toggle", async (req, res) => {
    try {
        const { userId, artworkId } = req.body;
        
        if (!userId || !artworkId) {
            return res.status(400).json({ success: false, message: "Missing userId or artworkId" });
        }

        
        const query = { userId, artworkId };
        const existingRecord = await wishlistCollection.findOne(query);

        if (existingRecord) 
        {
            
            await wishlistCollection.deleteOne(query);
            res.status(200).json({ success: true, isWishlisted: false, message: "Removed from wishlist" });
        } 
        else 
        {
            
            await wishlistCollection.insertOne({ 
                ...query, 
                createdAt: new Date().toISOString() 
            });

            res.status(200).json({ success: true, isWishlisted: true, message: "Added to wishlist" });
        }

    } 
    catch (error) 
    {
        console.error("Toggle Wishlist Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});


app.get("/api/wishlist/check/:artworkId", async (req, res) => {
    try {
        const { artworkId } = req.params;
        const { userId } = req.query; 

        if (!userId) {
            return res.status(200).json({ isWishlisted: false });
        }

        const existingRecord = await wishlistCollection.findOne({ userId, artworkId });
        
        
        res.status(200).json({ isWishlisted: !!existingRecord });
    } catch (error) {
        console.error("Check Wishlist Error:", error);
        res.status(500).json({ error: "Failed to check status" });
    }
});

app.get("/api/wishlist/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
      
        const pipeline = [
            { $match: { userId: userId } },
            
            { $addFields:{ artworkObjId: { $toObjectId: "$artworkId"}} },
            {
                $lookup: {
                    from: "artworks", 
                    localField: "artworkObjId",
                    foreignField: "_id",
                    as: "artworkDetails"
                }
            },
            { $unwind: "$artworkDetails" }, 
            { $sort: { createdAt: -1 } } 
        ];

        const userWishlist = await wishlistCollection.aggregate(pipeline).toArray();
        res.status(200).json(userWishlist);
    } catch (error) {
        console.error("Get Wishlist Error:", error);
        res.status(500).json({ error: "Failed to fetch wishlist" });
    }
});




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