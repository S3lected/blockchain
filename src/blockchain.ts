/**
 * based on https://hackernoon.com/learn-blockchains-by-building-one-117428612f46
 */
import * as url from "url";
import * as _ from "lodash";
import * as crypto from "crypto-js";
var request = require('request');
import * as http from "http";

interface Block {
    index: number;
    timestamp: Date;
    transactions: any[];
    proof: number;
    previousHash: string;
}

interface Transaction {
    sender: string;
    recipient: string;
    amount: number;
}

/**
 * 
 */
class Blockchain {
    public chain: Block[];
    private currentTransactions: Transaction[];
    public nodes: Set<string>;

    constructor() {
        this.chain = [];
        this.currentTransactions = [];

        this.nodes = new Set();

        // Create the genesis block
        this.newBlock(100, "1");
    }

    /**
     * Add a new node to the list of nodes
     * @param address Address of node. Eg. 'http://192.168.0.5:5000'
     */
    public registerNode(address: string): void {
        let parsedUrl = url.parse(address);
        this.nodes.add(parsedUrl.href);
    }

    /**
     * Determine if a given blockchain is valid.
     * True if valid, false if not.
     * @param chain A blockchain
     */
    public validChain(chain: Block[]): boolean {
        let lastBlock: Block = chain[0];
        let currentIndex: number = 1;

        while (currentIndex < chain.length) {
            let block: Block = chain[currentIndex];

            // Check that the hash of the block is correct
            let lastBlockHash = Blockchain.hash(lastBlock);
            if (!_.isEqual(block.previousHash, lastBlockHash))
                return false;

            // Check that the Proof of Work is correct
            if (!Blockchain.validProof(lastBlock.proof, block.proof, lastBlockHash))
                return false;

            lastBlock = block;
            currentIndex += 1;
        }

        return true;
    }

    /**
     *  This is our Consensus Algorithm, it resolves conflicts
     *  by replacing our chain with the longest one in the network.
     *  True if our chain was replaced, false if not
     */
    public async resolveConflicts(): Promise<boolean> {
        let neighbours = this.nodes;
        let newChain;

        // We're only looking for chains longer than ours
        let maxLength = this.chain.length;

        // Grab and verify the chains from all the nodes in our network
        for (let node of neighbours) {
            let url = "http://" + node + "/chain";

            await this.getRequest(url).then((val: any) => {
                let length = val.length;
                let chain = val.chain;

                // Check if the length is longer and the chain is valid
                if (length > maxLength && this.validChain(chain)) {
                    maxLength = length;
                    newChain = chain;
                }
            });


        };

        if (!_.isNil(newChain)) {
            this.chain = newChain;
            return true;
        }

        return false;
    }

    /**
     * Perform a GET request (REST) and return a promise.
     * @param url 
     */
    private getRequest(url) {
        return new Promise((resolve, reject) => {

            http.get(url, (resp) => {
                let data = '';

                // A chunk of data has been recieved.
                resp.on('data', (chunk) => {
                    data += chunk;
                });

                // The whole response has been received. Print out the result.
                resp.on('end', () => {
                    // console.log(JSON.parse(data));
                    resolve(JSON.parse(data))
                });

            }).on("error", (err) => {
                // console.log("Error: " + err.message);
                reject(err)
            });

        });
    }

    /**
     * Create a new Block in the Blockchain.
     * @param proof The proof given by the Proof of Work algorithm
     * @param previousHash (Optional) Hash of previous Block
     */
    public newBlock(proof: number = 100, previousHash?: string): Block {
        let block: Block = {
            'index': this.chain.length + 1,
            'timestamp': new Date(),
            'transactions': this.currentTransactions,
            'proof': proof,
            'previousHash': previousHash || Blockchain.hash(this.chain[this.chain.length - 1])
        }

        // Reset the current list of transactions
        this.currentTransactions = [];

        this.chain.push(block);
        return block;
    }

    /**
     *  Simple Proof of Work Algorithm:
     *  - Find a number p' such that hash(pp') contains leading 4 zeroes, where p is the previous p'
     *  - p is the previous proof, and p' is the new proof
     * @param lastBlock 
     */
    public proofOfWork(lastBlock: Block): number {
        let proof: number = 0;

        let lastProof = lastBlock.proof;
        let lastHash = Blockchain.hash(lastBlock);

        while (!Blockchain.validProof(lastProof, proof, lastHash))
            proof += 1;

        return proof;
    }

    /**
     * Creates a new transaction to go into the next mined Block
     * @param sender Address of the Sender
     * @param recipient Address of the Recipient
     * @param amount Amount
     */
    public newTransaction(sender: string, recipient: string, amount: number): number {
        this.currentTransactions.push({
            'sender': sender,
            'recipient': recipient,
            'amount': amount
        });

        return this.lastBlock.index + 1;
    }

    /**
     * Returns the last Block in the chain
     */
    get lastBlock() {
        return this.chain[this.chain.length - 1];
    }

    /**
     *  Creates a SHA-256 hash of a Block
     * @param block 
     */
    public static hash(block: Block) {
        /*"""
        Creates a SHA-256 hash of a Block
        :param block: <dict> Block
        :return: <str>
        """
        */

        // We must make sure that the Dictionary is Ordered, or we'll have inconsistent hashes
        let blockString: string = JSON.stringify(block);

        var eHex = crypto.SHA256(blockString).toString(crypto.enc.Hex);

        return eHex; //.hexdigest();
    }

    /**
     * Validates the Proof: Does hash(last_proof, proof) contain 4 leading zeroes?
     * @param lastProof Previous Proof
     * @param proof Current Proof
     * Returns true if correct, false if not.
     */
    public static validProof(lastProof: number, proof: number, lastHash: string): boolean {
        let guess = lastProof.toString() + '' + proof.toString() + '' + lastHash;
        let guessHash: any = crypto.SHA256(guess); //.hexdigest();

        var eHex: string = crypto.SHA256(guess).toString(crypto.enc.Hex);
        guessHash = eHex;

        return _.isEqual(guessHash.slice(-4), "0000");
    }
}

/**
 * Our Blockchain as an API
 */

import express = require('express');


import uuidv4 = require('uuid/v4');
import { promises } from "fs";
import { rejects } from "assert";

// Instantiate our Node
let app = express();
app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded({ extended: true })); // to support URL-encoded bodies

// Generate a globally unique address for this node
let nodeIdentifier = uuidv4().toString().replace('-', '')

// Instantiate the Blockchain
let blockchain = new Blockchain();


app.get('/mine', (req, res) => {
    console.log("We'll mine a new Block");

    // We run the proof of work algorithm to get the next proof...
    let lastBlock = blockchain.lastBlock;
    let proof = blockchain.proofOfWork(lastBlock);

    // We must receive a reward for finding the proof.
    // The sender is "0" to signify that this node has mined a new coin.
    blockchain.newTransaction("0", nodeIdentifier, 1);

    // Forge the new Block by adding it to the chain
    let previousHash = Blockchain.hash(lastBlock);
    let block = blockchain.newBlock(proof, previousHash);

    let response = {
        'message': "New Block Forged",
        'index': block.index,
        'transactions': block.transactions,
        'proof': block.proof,
        'previous_hash': block.previousHash
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200);
    res.send(JSON.stringify(response));
});

app.post('/transactions/new', (req, res) => {
    console.log("We'll add a new transaction");
    console.log(req.body)
    let values = req.body;
    // Check that the required fields are in the POST'ed data
    const required = ['sender', 'recipient', 'amount'];
    // TODO

    // Create a new Transaction
    let index = blockchain.newTransaction(values.sender, values.recipient, values.amount);

    let response = { 'message': 'Transaction will be added to Block ' + index }

    res.setHeader('Content-Type', 'application/json');
    res.status(201);
    res.send(JSON.stringify(response));
});

app.get('/chain', (req, res) => {
    let response = {
        'chain': blockchain.chain,
        'length': blockchain.chain.length
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200);
    res.send(JSON.stringify(response));
});


app.post('/nodes/register', (req, res) => {
    // register_nodes
    let values = req.body;
    let nodes = values.nodes;

    if (_.isNil(nodes)) {
        res.status(400);
        res.send("Error: Please supply a valid list of nodes");
    }

    _.each(nodes, node => {
        blockchain.registerNode(node);
    });

    let response = {
        'message': 'New nodes have been added',
        'totalNodes': [...blockchain.nodes]
    };

    res.setHeader('Content-Type', 'application/json');
    res.status(201);
    res.send(JSON.stringify(response));
});



app.get('/nodes/resolve', async (req, res) => {
    // consensus
    let response;
    let replaced = await blockchain.resolveConflicts();

    if (replaced) {
        response = {
            'message': 'Our chain was replaced',
            'newChain': blockchain.chain
        }
    } else {
        response = {
            'message': 'Our chain is authoritative',
            'chain': blockchain.chain
        }
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200);
    res.send(JSON.stringify(response));

});


const port = process.argv[2] || 5000;

app.listen(port, (err) => {
    if (err) {
        return console.log(err);
    }
    return console.log("server is listening on " + port);
});