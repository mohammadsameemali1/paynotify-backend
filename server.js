const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const MONTHLY_PLAN_ID = "plan_TbP75KFbxnFJKg";
const YEARLY_PLAN_ID = "plan_TbP7fo9ONbOLg5";

app.get("/", (req, res) => {
    res.status(200).send("PayNotify backend is running");
});

app.use(express.json());

app.post("/create-subscription", async (req, res) => {
    try {
        const planType = req.body.planType;

        let planId;

        if (planType === "MONTHLY") {
            planId = MONTHLY_PLAN_ID;
        } else if (planType === "YEARLY") {
            planId = YEARLY_PLAN_ID;
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid plan type"
            });
        }

        const auth = Buffer.from(
            RAZORPAY_KEY_ID + ":" + RAZORPAY_KEY_SECRET
        ).toString("base64");

        const response = await fetch(
            "https://api.razorpay.com/v1/subscriptions",
            {
                method: "POST",
                headers: {
                    "Authorization": "Basic " + auth,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    plan_id: planId,
                    total_count: 300,
                    quantity: 1,
                    customer_notify: 1,
                    notes: {
                        plan: planType
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                message: "Razorpay subscription creation failed",
                error: data
            });
        }

        res.json({
            success: true,
            subscription_id: data.id,
            plan_id: data.plan_id,
            status: data.status
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

app.post(
    "/razorpay/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => {

        try {
            const receivedSignature =
                req.headers["x-razorpay-signature"];

            if (!receivedSignature || !WEBHOOK_SECRET) {
                return res.status(400).send("Webhook configuration error");
            }

            const expectedSignature = crypto
                .createHmac("sha256", WEBHOOK_SECRET)
                .update(req.body)
                .digest("hex");

            if (expectedSignature !== receivedSignature) {
                return res.status(400).send("Invalid signature");
            }

            const payload = JSON.parse(req.body.toString("utf8"));

            console.log("Razorpay Event:", payload.event);

            return res.status(200).json({
                received: true
            });

        } catch (error) {
            console.error(error);
            return res.status(400).send("Invalid webhook");
        }
    }
);

app.listen(PORT, "0.0.0.0", () => {
    console.log("PayNotify backend running on port " + PORT);
});
