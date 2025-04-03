import express from "express";
import mongoose, { Schema, Document } from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();



const app = express();
app.use(cors());
app.use(express.json());

// -----------------------
// Database Connection
// -----------------------
mongoose
  .connect(process.env.MONGODB_URI || "")
  .then(() => console.log("MongoDB connected"))
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });

// -----------------------
// Models
// -----------------------

// Grocery Model
interface IGrocery extends Document {
  name: string;
  price: number;
  inventory: number;
}

const GrocerySchema: Schema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  inventory: { type: Number, required: true },
});

const Grocery = mongoose.model<IGrocery>("grocery", GrocerySchema);

// Order Model
interface IOrderItem {
  grocery: mongoose.Types.ObjectId;
  quantity: number;
}

interface IOrder extends Document {
  userId: string;
  items: IOrderItem[];
  createdAt: Date;
}

const OrderSchema: Schema = new Schema({
  userId: { type: String, required: true },
  items: [
    {
      grocery: { type: mongoose.Schema.Types.ObjectId, ref: "Grocery", required: true },
      quantity: { type: Number, required: true },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

const Order = mongoose.model<IOrder>("Order", OrderSchema);

// -----------------------
// Admin Routes
// -----------------------

// Add new grocery item
app.post("/api/admin/grocery", async (req, res) => {
  try {
    const { name, price, inventory } = req.body;
    const grocery = new Grocery({ name, price, inventory });
    await grocery.save();
    res.status(201).json(grocery);
  } catch (error) {
    res.status(500).json({ error: "Failed to add grocery item" });
  }
});

// View existing grocery items
app.get("/api/admin/grocery", async (req, res) => {
  try {
    const groceries = await Grocery.find();
    res.json(groceries);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch grocery items" });
  }
});

// Update grocery item details
app.put("/api/admin/grocery/:id", async (req, res) => {
  try {
    const { name, price, inventory } = req.body;
    const grocery = await Grocery.findByIdAndUpdate(
      req.params.id,
      { name, price, inventory },
      { new: true }
    );
    if (!grocery) return res.status(404).json({ error: "Grocery item not found" });
    res.json(grocery);
  } catch (error) {
    res.status(500).json({ error: "Failed to update grocery item" });
  }
});

// Remove grocery item
app.delete("/api/admin/grocery/:id", async (req, res) => {
  try {
    const grocery = await Grocery.findByIdAndDelete(req.params.id);
    if (!grocery) return res.status(404).json({ error: "Grocery item not found" });
    res.json({ message: "Grocery item removed successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove grocery item" });
  }
});

// -----------------------
// User Routes
// -----------------------

// View available grocery items (inventory > 0)
app.get("/api/grocery", async (req, res) => {
  try {
    const groceries = await Grocery.find({ inventory: { $gt: 0 } });
    res.json(groceries);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch grocery items" });
  }
});

// Book multiple grocery items in a single order
app.post("/api/booking", async (req, res) => {
  try {
    const { userId, items } = req.body; // items: array of { groceryId, quantity }
    
    // Check and update inventory for each item
    for (const item of items) {
      const grocery = await Grocery.findById(item.groceryId);
      if (!grocery || grocery.inventory < item.quantity) {
        return res.status(400).json({
          error: `Insufficient inventory for item: ${item.groceryId}`,
        });
      }
      grocery.inventory -= item.quantity;
      await grocery.save();
    }
    
    const order = new Order({
      userId,
      items: items.map((item: any) => ({ grocery: item.groceryId, quantity: item.quantity })),
    });
    await order.save();
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to create order" });
  }
});

// -----------------------
// Start the Server
// -----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
 