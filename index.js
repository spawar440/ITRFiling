const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const Razorpay = require("razorpay");
const cors = require("cors");
const twilio = require("twilio");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 5000;
console.log(PORT);
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});
const JWT_SECRET = process.env.JWT_SECRET;

// Define a User model (assuming you're using Mongoose)
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ["admin", "superadmin"], // Role can be either admin or superadmin
    default: "admin",
  },
});
const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  // Add more fields as needed
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Create a Payment model based on the schema
const Payment = mongoose.model("Payment", paymentSchema);

// Define the schema for the Task model
const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin", // Reference to the Admin model
    required: true,
  },
  adminEmail: {
    type: String,
    required: true,
  },
  ticketNumber: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create the Task model using the schema
const Task = mongoose.model("Task", taskSchema);

const SuperAdmin = mongoose.model("Admin", adminSchema);
const User = mongoose.model("User", UserSchema);
// Create a Mongoose model for your document post
const Document = mongoose.model("Document", {
  pancardBase64: String,
  adharCardBase64: String,
  loanStatementBase64: String,
  bankStatementBase64: String,
  form16Base64: String,
  interestCertificateBase64: String,
  mobilenumber: String,
  email: String,
  password: String,
  excelSheetBase64: String,
  ticketNumber: String,
  phoneNumber: String,
  documentType: String,
  status: String,
});

// schema for contact

const Contact = mongoose.model("contacts", {
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  message: { type: String, required: true },
});

// Generate unique ticket number
function generateTicketNumber() {
  // Implement your logic to generate a unique ticket number
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

//get all documents
app.get("/getdocuments", async (req, res) => {
  try {
    const documents = await Document.find();
    res.json(documents);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/upload", async (req, res) => {
  try {
    const {
      pancardBase64,
      adharCardBase64,
      loanStatementBase64,
      bankStatementBase64,
      form16Base64,
      interestCertificateBase64,
      mobilenumber,
      email,
      password,
      excelSheetBase64,
      ticketNumber,
      phoneNumber,
      documentType,
      status, // New field for userId
    } = req.body;

    // Check if a document already exists for the given phone number
    const existingDocument = await Document.findOne({ phoneNumber });

    if (existingDocument) {
      // If document already exists, update its details
      existingDocument.pancardBase64 = pancardBase64;
      existingDocument.documentType = documentType;
      existingDocument.mobilenumber = mobilenumber;
      existingDocument.adharCardBase64 = adharCardBase64;
      existingDocument.loanStatementBase64 = loanStatementBase64;
      existingDocument.bankStatementBase64 = bankStatementBase64;
      existingDocument.form16Base64 = form16Base64;
      existingDocument.interestCertificateBase64 = interestCertificateBase64;
      existingDocument.email = email;
      existingDocument.password = password;
      existingDocument.excelSheetBase64 = excelSheetBase64;
      existingDocument.ticketNumber = ticketNumber;
      existingDocument.status = status;

      await existingDocument.save();

      // Send the response with success message and ticket number
      res.status(200).json({
        message: "Document details updated successfully",
        ticketNumber: existingDocument.ticketNumber,
      });
    } else {
      // If no document exists, create a new document
      const newDocument = new Document({
        pancardBase64,
        adharCardBase64,
        loanStatementBase64,
        bankStatementBase64,
        form16Base64,
        interestCertificateBase64,
        mobilenumber,
        email,
        password,
        excelSheetBase64,
        ticketNumber,
        phoneNumber,
        documentType,
        status,
      });

      await newDocument.save();

      // Send the response with success message and ticket number
      res
        .status(201)
        .json({ message: "Document uploaded successfully", ticketNumber });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

//phone num find
app.get("/getTicketNumberByPhoneNumber/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const document = await Document.findOne({ phoneNumber });
    if (document) {
      res.json({ ticketNumber: document.ticketNumber });
    } else {
      res.json({ ticketNumber: null });
    }
  } catch (error) {
    console.error("Error fetching ticket number:", error);
    res.status(500).send("Internal Server Error");
  }
});
//save document
app.post("/saveTicketNumber", async (req, res) => {
  try {
    const { phoneNumber, ticketNumber } = req.body;
    const document = new Document({ phoneNumber, ticketNumber });
    await document.save();
    res.status(201).send("Ticket number saved successfully");
  } catch (error) {
    console.error("Error saving ticket number:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Update ticket status
app.put("/updateTicketStatus/:ticketNumber", async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    const { adminStatus } = req.body;
    // Update the ticket status in the database
    const updatedDocument = await Document.findOneAndUpdate(
      { ticketNumber },
      { $set: { status: adminStatus } }, // Correctly set the status field
      { new: true }
    );

    res.json(updatedDocument);
  } catch (error) {
    console.error("Error updating ticket status:", error);
    res.status(500).send("Internal Server Error");
  }
});

///get status of user
app.get("/getTicketStatus/:ticketNumber", async (req, res) => {
  try {
    const { ticketNumber } = req.params;

    const document = await Document.findOne({ ticketNumber });

    if (document) {
      res.json({ status: document.status });
    } else {
      res.json({ status: null });
    }
  } catch (error) {
    console.error("Error fetching ticket status:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Get ticket number and status
app.get("/tickets/:ticketNumber", async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    const document = await Document.findOne({ ticketNumber });
    if (document) {
      // If the document is found, send its status
      res.json({ status: document.status });
    } else {
      // If no document is found, send null status
      res.json({ status: null });
    }
  } catch (error) {
    console.error("Error fetching ticket status:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Route to handle form submissions
// Route to handle form submissions
app.post("/contact", async (req, res) => {
  const { email, phoneNumber, message } = req.body;

  try {
    // Create a new contact document
    const newContact = new Contact({ email, phoneNumber, message });

    // Save the contact to the database
    await newContact.save();

    // Respond with success message
    res
      .status(201)
      .json({ message: "Form submitted successfully", contact: newContact });
  } catch (error) {
    console.error("Error saving contact:", error);
    res
      .status(500)
      .json({ error: "An error occurred while saving the contact" });
  }
});





// show conatact us users to admin
app.get("/contacts", async (req, res) => {
  try {
    // Fetch all contact messages from the database
    const contacts = await Contact.find();

    // Respond with the array of contact messages
    res.status(200).json({ contacts });
  } catch (error) {
    console.error("Error fetching contact messages:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching contact messages" });
  }
});

// //admin routes
// app.post("/api/login", async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     // Check if the user exists
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     // Compare passwords
//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     // Generate JWT token
//     const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
//       expiresIn: "1h",
//     });

//     // If both email and password are correct, return success with token
//     return res.status(200).json({ message: "Login successful", token });
//   } catch (error) {
//     console.error("Login failed:", error);
//     return res.status(500).json({ message: "Login failed" });
//   }
// });
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // If both email and password are correct, return success with token and email
    return res.status(200).json({ message: "Login successful", token, email });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ message: "Login failed" });
  }
});
// Route for user registration
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    // Generate JWT token
    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    return res
      .status(200)
      .json({ message: "User registered successfully", token });
  } catch (error) {
    console.error("Registration failed:", error);
    return res.status(500).json({ message: "Registration failed" });
  }
});

//superadmin login
//mail -bestowal@gmail.com
//pasword = Poasxsa@123

app.post("/superadminlogin", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find superadmin by email
    const superadminn = await SuperAdmin.findOne({ email });
    if (!superadminn) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(
      password,
      superadminn.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: superadminn._id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // If email and password are valid, return success with token
    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ message: "Login failed" });
  }
});

//get all admins route
// Route to get all admins
app.get("/getAdmins", async (req, res) => {
  try {
    // Query the User model for documents with role "admin"
    const admins = await User.find({ role: "admin" });

    // Respond with the array of admin documents
    res.status(200).json({ admins });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ error: "An error occurred while fetching admins" });
  }
});

//delete admin 
app.delete("/deleteAdmin/:adminId", async (req, res) => {
  const adminId = req.params.adminId;
  try {
    await User.findByIdAndDelete(adminId);
    res.status(200).json({ message: "Admin deleted successfully" });
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(500).json({ error: "An error occurred while deleting admin" });
  }
});




// Route to assign a task to an admin
app.post("/assignTask", async (req, res) => {
  try {
    const { title, description, adminId, adminEmail, ticketNumber } = req.body;

    // Create a new task document
    const task = new Task({
      title,
      description,
      assignedTo: adminId, // Assign the task to the selected admin
      adminEmail, // Save the admin's email
      ticketNumber, // Save the ticket number
    });

    // Save the task to the database
    await task.save();

    res.status(201).json({ message: "Task assigned successfully", task });
  } catch (error) {
    console.error("Error assigning task:", error);
    res.status(500).json({ message: "Failed to assign task" });
  }
});

app.get("/tickets", async (req, res) => {
  try {
    const tickets = await Document.find().distinct("ticketNumber");
    res.status(200).json(tickets);
  } catch (error) {
    console.error("Error fetching ticket numbers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// find tasks to admins
app.get("/api/tasks/:email", async (req, res) => {
  const { email } = req.params; // Get the email from the request params

  try {
    // Find all tasks where adminEmail matches the provided email
    const tasks = await Task.find({ adminEmail: email });

    res.status(200).json({ tasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route to get all tasks assigned to admins
app.get("/tasks", async (req, res) => {
  try {
    // Fetch all tasks from the database
    const tasks = await Task.find().populate("assignedTo", "email");

    res.status(200).json({ tasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "An error occurred while fetching tasks" });
  }
});

// Route to get documents by ticket number
app.get("/:ticketNumber", async (req, res) => {
  const { ticketNumber } = req.params;

  try {
    // Find documents by ticket number
    const documents = await Document.find({ ticketNumber });

    res.status(200).json({ documents });
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ message: "Error fetching documents" });
  }
});

// // Create a Twilio client
// const twilioClient = twilio('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SENDMAIL,
    pass: process.env.PASSWORDMAIL,
  },
});

// Initialize Razorpay client
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEYID,
  key_secret: process.env.RAZORPAY_KEY,
});

// razorpay
// Route to proceed to payment by ticket number
app.put("/proceedToPayment/:ticketNumber", async (req, res) => {
  const { ticketNumber } = req.params;

  try {
    // Find the document by ticket number
    const document = await Document.findOne({ ticketNumber });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if the document status is "proceed to payment"
    if (document.status === "proceed to payment") {
      // Create Razorpay order
      const order = await razorpay.orders.create({
        amount: 10000, // Amount in paise (e.g., ₹100 = 10000)
        currency: "INR",
        receipt: "order_receipt",
        payment_capture: 1, // Auto capture payment
      });
      
      const paymentUrl = "https://rzp.io/i/W4I0vEutf";

      // Send email to the user
      const mailOptions = {
        from: "patilrushikesh.walsystems@gmail.com",
        to: document.email,
        subject: "Payment Link",
        text: `Dear User,\n\nPlease proceed to payment by clicking on the following link: ${paymentUrl}`,
      };

      await transporter.sendMail(mailOptions);

      // Return the order details along with the success message
      return res.status(200).json({ message: "Payment link sent successfully", order });
    } else {
      // If the document status is not "proceed to payment", respond with an error message
      return res.status(400).json({ message: "Document status is not 'proceed to payment'" });
    }
  } catch (error) {
    console.error("Error proceeding to payment:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});


// check payment status





app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
