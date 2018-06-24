"use strict";
/**
 * https://hackernoon.com/learn-blockchains-by-building-one-117428612f46
 */
exports.__esModule = true;
var sha256_1 = require("crypto-js/sha256");
/**
 *
 */
var Blockchain = /** @class */ (function () {
    function Blockchain() {
        this.chain = [];
        this.currentTransactions = [];
        // Create the genesis block
        this.newBlock(100, "1");
    }
    /**
     * Create a new Block in the Blockchain.
     * @param proof The proof given by the Proof of Work algorithm
     * @param previousHash (Optional) Hash of previous Block
     */
    Blockchain.prototype.newBlock = function (proof, previousHash) {
        if (proof === void 0) { proof = 100; }
        var block = {
            'index': this.chain.length + 1,
            'timestamp': new Date(),
            'transactions': this.currentTransactions,
            'proof': proof,
            'previousHash': previousHash || Blockchain.hash(this.chain[this.chain.length - 1])
        };
        // Reset the current list of transactions
        this.currentTransactions = [];
        this.chain.push(block);
        return block;
    };
    /**
     *  Simple Proof of Work Algorithm:
     *  - Find a number p' such that hash(pp') contains leading 4 zeroes, where p is the previous p'
     *  - p is the previous proof, and p' is the new proof
     * @param lastProof
     */
    Blockchain.prototype.proofOfWork = function (lastProof) {
        var proof = 0;
        while (Blockchain.validProof(lastProof, proof))
            proof += 1;
        return proof;
    };
    /**
     * Creates a new transaction to go into the next mined Block
     * @param sender Address of the Sender
     * @param recipient Address of the Recipient
     * @param amount Amount
     */
    Blockchain.prototype.newTransaction = function (sender, recipient, amount) {
        this.currentTransactions.push({
            'sender': sender,
            'recipient': recipient,
            'amount': amount
        });
        return this.lastBlock.index + 1;
    };
    Object.defineProperty(Blockchain.prototype, "lastBlock", {
        /**
         * Returns the last Block in the chain
         */
        get: function () {
            return this.chain[this.chain.length - 1];
        },
        enumerable: true,
        configurable: true
    });
    /**
     *  Creates a SHA-256 hash of a Block
     * @param block
     */
    Blockchain.hash = function (block) {
        /*"""
        Creates a SHA-256 hash of a Block
        :param block: <dict> Block
        :return: <str>
        """
        */
        // We must make sure that the Dictionary is Ordered, or we'll have inconsistent hashes
        var blockString = JSON.stringify(block);
        return sha256_1["default"](blockString).hexdigest();
    };
    /**
     * Validates the Proof: Does hash(last_proof, proof) contain 4 leading zeroes?
     * @param lastProof Previous Proof
     * @param proof Current Proof
     * Returns true if correct, false if not.
     */
    Blockchain.validProof = function (lastProof, proof) {
        var guess = lastProof.toString() + proof.toString();
        var guessHash = sha256_1["default"](guess).hexdigest();
        return guessHash.slice(-4) === "0000";
    };
    return Blockchain;
}());
/**
 * Our Blockchain as an API
 */
var express = require("express");
// import * as _ from "lodash";
var uuidv4 = require("uuid/v4");
// Instantiate our Node
var app = express();
// Generate a globally unique address for this node
var nodeIdentifier = uuidv4().toString().replace('-', '');
// Instantiate the Blockchain
var blockchain = new Blockchain();
app.get('/mine', function (req, res) {
    console.log("We'll mine a new Block");
    // We run the proof of work algorithm to get the next proof...
    var lastBlock = blockchain.lastBlock;
    var lastProof = lastBlock.proof;
    var proof = blockchain.proofOfWork(lastProof);
    // We must receive a reward for finding the proof.
    // The sender is "0" to signify that this node has mined a new coin.
    blockchain.newTransaction("0", nodeIdentifier, 1);
    // Forge the new Block by adding it to the chain
    var previousHash = Blockchain.hash(lastBlock);
    var block = blockchain.newBlock(proof, previousHash);
    var response = {
        'message': "New Block Forged",
        'index': block.index,
        'transactions': block.transactions,
        'proof': block.proof,
        'previous_hash': block.previousHash
    };
    res.send(JSON.stringify(response));
});
app.post('/transactions/new', function (req, res) {
    console.log("We'll add a new transaction");
    var values = JSON.parse(req);
    // Check that the required fields are in the POST'ed data
    var required = ['sender', 'recipient', 'amount'];
    // TODO
    // Create a new Transaction
    var index = blockchain.newTransaction(values.sender, values.recipient, values.amount);
    var response = { 'message': 'Transaction will be added to Block ' + index };
    res.send(JSON.stringify(response));
});
app.get('/chain', function (req, res) {
    var response = {
        'chain': blockchain.chain,
        'length': blockchain.chain.length
    };
    res.send(JSON.stringify(response));
});
app.listen(5000);
