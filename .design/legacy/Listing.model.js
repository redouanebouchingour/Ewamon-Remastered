const mongoose = require("mongoose");
const { EwamonInstanceSchema } = require("./Player");

const BidEntrySchema = new mongoose.Schema({
  bidderId:        { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
  bidderUsername:  { type: String, required: true },
  amount:          { type: Number, required: true },
  placedAt:        { type: Date, default: Date.now },
}, { _id: false });

const ListingSchema = new mongoose.Schema({
  sellerId:             { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
  sellerUsername:       { type: String, required: true },
  ewamon:               { type: EwamonInstanceSchema, required: true }, // full escrow copy
  startingBid:          { type: Number, required: true, min: 1 },
  buyNowPrice:          { type: Number, default: null },   // null = auction only
  currentBid:           { type: Number, default: null },   // null = no bids yet
  currentBidderId:      { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
  currentBidderUsername: { type: String, default: null },
  bids:                 { type: [BidEntrySchema], default: [], validate: v => v.length <= 200 },
  status:               { type: String, enum: ["active", "sold", "expired", "cancelled"], default: "active" },
  duration:             { type: Number, enum: [24, 48, 72], required: true },
  expiresAt:            { type: Date, required: true },
  resolvedAt:           { type: Date, default: null },
  createdAt:            { type: Date, default: Date.now },
}, {
  // Mongoose 8: throws VersionError if the doc's __v has changed between read
  // and save. We additionally use findOneAndUpdate-with-predicate for the hot
  // bid/buy-now/cancel paths so the listing flip is the single linearization
  // point — even one missed save would otherwise allow coin duplication.
  optimisticConcurrency: true,
});

// Indexes for common query patterns
ListingSchema.index({ status: 1, expiresAt: 1 });             // expiry resolver
ListingSchema.index({ sellerId: 1, status: 1 });              // my-listings
ListingSchema.index({ status: 1, createdAt: -1 });            // default browse sort
ListingSchema.index({ status: 1, "ewamon.speciesId": 1 });    // species filter
ListingSchema.index({ status: 1, "ewamon.level": 1 });        // level range filter
ListingSchema.index({ status: 1, currentBidderId: 1 });       // my-bids

module.exports = mongoose.model("Listing", ListingSchema);
