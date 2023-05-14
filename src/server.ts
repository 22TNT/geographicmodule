import express, {Request, Response} from "express";
import bodyParser from 'body-parser';
import {Simulation} from "./model/simulation";
import {Frame} from "./model/frame";
import {State} from "./model/state";

const cors = require("cors");
const PORT = 3001;

let simulations: { [key: string]: Simulation } = {};
const app = express();
app.use(bodyParser.json());
app.use(cors({
    credentials: true,
    methods: ["GET", "POST"],
    origin: true,
}));

type ExportableNode = {
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
    contamination: State[],
}

app.post("/simulation", (req: Request, res: Response) => {
    // create new simulation
    const {
        lat1, lng1,
        lat2, lng2,
        len,
    } = req.body;
    const sim = new Simulation(parseFloat(lat1), parseFloat(lng1), parseFloat(lat2), parseFloat(lng2), parseFloat(len),);
    simulations[sim.id] = sim;
    res.status(201).json({"id": sim.id});
});

app.post("/simulation/:id/contamination", (req: Request, res: Response) => {
    // add new contamination
    if (!simulations[req.params.id]) {
        res.status(404).json("No simulation with that id");
    }
    const {
        lat,
        lng,
        state,
    } = req.body;
    try {
        simulations[req.params.id].addContamination(lat, lng, state);
        res.sendStatus(200);
    } catch (e) {
        res.status(400).json("Incorrect coordinates");
    }
});

app.post("/simulation/:id/source", (req: Request, res:Response) => {
    if (!simulations[req.params.id]) {
        res.status(404).json("No simulation with that id");
    }
    const {
        lat,
        lng,
        height,
        power,
        dispH,
        dispV,
        material,
    } = req.body;
    try {
        simulations[req.params.id].addSource(
            parseFloat(lat),
            parseFloat(lng),
            parseFloat(height),
            material,
            parseFloat(power),
            parseFloat(dispH),
            parseFloat(dispV));
        res.sendStatus(200);
    }
    catch (e) {
        res.status(500).json("something went wrong");
    }

})

app.post("/simulation/:id/frame", (req: Request, res: Response) => {
    // advance by a number of frames
    if (!simulations[req.params.id]) {
        res.status(404).send("No simulation with that id");
    }

    const frames: number = req.body.frames;
    if (frames <= 0) {
        res.status(400).send("Frames has to be positive");
    }

    for (let i: number = 0; i < frames; i++) {
        simulations[req.params.id].nextFrame();
    }
    res.status(200).send(`${simulations[req.params.id].frames.length}`);
});

app.post("/simulation/:id/wind", (req: Request, res: Response) => {
    if (!simulations[req.params.id]) {
        res.status(404).send("No simulation with that id");
    }

    const {
        tick,
        wind,
    } = req.body;

    simulations[req.params.id].addWind(parseInt(tick), {
        direction: parseFloat(wind.direction), speed: parseFloat(wind.speed)});
    res.sendStatus(200);
})

app.get("/simulation/:id/wind/:index", (req:Request, res:Response) => {
    if (!simulations[req.params.id]) {
        res.status(404).send("No simulation with that id");
    }

    const sim = simulations[req.params.id];
    res.status(200).send(
        JSON.stringify(sim.winds.get(sim.keyFinder(parseInt(req.params.index))))
    )
})

app.get("/simulation/:id/frame/:index", (req: Request, res: Response) => {
    // get a certain frame
    if (!simulations[req.params.id]) {
        res.status(404).send("No simulation with that id");
    }

    if (simulations[req.params.id].frames.length === 0) {
        res.status(404).send("No frames in that simulation");
    }

    const index: number = +req.params.index;
    if (index === -1) {
        res.status(200).send(JSON.stringify(simulations[req.params.id].frames.slice(-1)[0]));
    }

    if (simulations[req.params.id].frames.length >= index) {
        res.status(200).send(JSON.stringify(simulations[req.params.id].frames[index]));
    } else {
        res.status(500).send("Unreachable");
    }
});

app.get("/simulation/:id/info", (req: Request, res: Response) => {
    if (!simulations[req.params.id]) {
        res.status(404).send("No simulation with that id");
    }

    const sim = simulations[req.params.id];
    res.status(200).send(JSON.stringify({
        id: sim.id,
        lat1: sim.startLat,
        lng1: sim.startLng,
        lat2: sim.endLat,
        lng2: sim.endLng,
        length: sim.length,
    }));
});

app.get("/simulation/:id/source", (req: Request, res: Response) => {
    if (!simulations[req.params.id]) {
        res.status(404).send("No simulation with that id");
    }

    const sim = simulations[req.params.id];
    res.status(200).send(JSON.stringify(sim.sources));
})

app.get("/simulation/v2/:id/frame/:index", (req: Request, res: Response) => {
    // get all not empty nodes from a frame with all 4 coords
    if (!simulations[req.params.id]) {
        res.status(404).send("No simulation with that id");
    }

    if (simulations[req.params.id].frames.length === 0) {
        res.status(404).send("No frames in that simulation");
    }

    const len = simulations[req.params.id].frames.length;
    let frame: Frame;
    const index: number = parseInt(req.params.index);
    if (len + index < 0 || index>=len) {
        res.sendStatus(400);
    }
    else if ((index < 0) && (len + index >= 0)) {
        frame = simulations[req.params.id].frames[len+index];
    }
    else {
        frame = simulations[req.params.id].frames[index];
    }

    let nodes: ExportableNode[] = [];
    for (let i = 0; i < frame.map.length; i++) {
        for (let j = 0; j < frame.map[i].length; j++) {
            const node = frame.map[i][j];
            if (node.contaminations.length !== 0) {
                const latlng: [number, number] = Simulation.prototype.getOffsetCoords(node.lat, node.lng, len, len);
                nodes.push({
                    lat1: node.lat,
                    lng1: node.lng,
                    lat2: latlng[0],
                    lng2: latlng[1],
                    contamination: node.contaminations,
                });
            }
        }
    }
    res.status(200).send(nodes);

});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`)
});
