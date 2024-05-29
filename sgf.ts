
function iswhitespace(c): boolean {
    return (c == '\n' || c == ' ' || c == '\t' || c == '\r' || c == '\v');
}

type SgfError = {
    type: "error";
    message: string;
}

type Collection = {
    type: "collection";
    head: GameTree;
    tail: GameTree[];
}

type GameTree = {
    type: "gametree";
    head: Sequence;
    tail: GameTree[];
}

type Sequence = {
    type: "sequence";
    head: Node;
    tail: Node[];
}

type Node = {
    type: "node";
    properties: Property[];
}

type Property = {
    type: "property";
    propident: string;
    propvalue: string;
    propvalues: string[];
}

type PropIdent = {
    type: "propident";
    value: string;
}

type PropValue = {
    type: "propvalue";
    value: string;
}

class Parser {
    text: string;
    index: number;
    constructor(text: string) {
        this.text = text;
        this.index = 0;
    }

    read(): string {
        if (this.index >= this.text.length) {
            return '\0';
        }
        let result = this.text[this.index];
        this.index++;
        return result;
    }

    peek(n=0): string {
        if (this.index+n >= this.text.length) {
            return '\0';
        }
        return this.text[this.index+n];
    }

    read_whitespace() {
        while (true) {
            if (iswhitespace(this.peek())) {
                this.read();
            } else {
                break;
            }
        }
    }

    parse(): Collection | SgfError {
        this.read_whitespace();
        if (this.peek() != '(') {
            return {"type": "error", "message": "expected '('"};
        }
        let head = this.parse_gametree();
        if (head.type == "error") {
            return head;
        }
        let tail = [];
        while (true) {
            if (this.peek() == '\0') {
                break;
            } else if (this.peek() != '(') {
                return {"type": "error", "message": "expected '('"};
            } else {
                let gt = this.parse_gametree();
                if (gt.type == "error") {
                    return gt;
                }
                tail.push(gt);
            }
        }
        this.read_whitespace();
        return {"type": "collection", "head": head, "tail": tail};
    }

    parse_gametree(): GameTree | SgfError {
        // assume first character is '('
        this.read();
        let seq = this.parse_sequence();
        if (seq.type == "error") {
            return seq;
        }
        let tail = [];
        while (true) {
            if (this.peek() != '(') {
                break;
            }
            let gt = this.parse_gametree();
            if (gt.type == "error") {
                return gt;
            }
            tail.push(gt);
        }
        let r = this.read();
        if (r != ')') {
            console.log(r);
            return {"type": "error", "message": "expected ')'"};
        }
        this.read_whitespace();
        return {"type": "gametree", "head": seq, "tail": tail};
    }

    parse_sequence(): Sequence | SgfError {
        if (this.peek() != ';') {
            return {"type": "error", "message": "expected ';'"};
        }
        let node = this.parse_node();
        if (node.type == "error") {
            return node;
        }
        let nodes = [];
        while (true) {
            if (this.peek() != ';') {
                break;
            }
            let n = this.parse_node();
            if (n.type == "error") {
                return n;
            }
            nodes.push(n);
        }
        this.read_whitespace();
        return {"type": "sequence", "head": node, "tail": nodes};
    }

    parse_node(): Node | SgfError {
        // assume it starts with ';'
        this.read();
        let props = [];
        while (true) {
            if (this.peek() >= 'A' && this.peek() <= 'Z') {
                let prop = this.parse_property();
                if (prop.type == "error") {
                    return prop;
                }
                props.push(prop);
            } else {
                break;
            }
        }
        this.read_whitespace();
        return {"type": "node", "properties": props};
    }

    parse_property(): Property | SgfError {
        let propident = this.parse_propident();
        if (propident.type == "error") {
            return propident;
        }
        if (this.peek() != "[") {
            return {"type": "error", "message": "expected '['"};
        }
        let propvalue = this.parse_propvalue();
        if (propvalue.type == "error") {
            return propvalue;
        }
        let propvalues = [];
        while (true) {
            if (this.peek() != "[") {
                break;
            }
            let pv = this.parse_propvalue();
            if (pv.type == "error") {
                return pv;
            }
            propvalues.push(pv);
        }
        this.read_whitespace();
        return {"type": "property", "propident": propident, "propvalue": propvalue, "propvalues": propvalues};
    }

    parse_propident(): PropIdent | SgfError {
        let result = '';
        while (true) {
            let p = this.peek();
            if (p >= 'A' && p <= 'Z') {
                result += this.read();
            } else {
                break;
            }
        }
        if (result.length == 0) {
            return {"type": "error", "message": "expected propident"};
        }
        this.read_whitespace();
        return {"type": "propident", "value": result};
    }

    parse_propvalue(): PropValue | SgfError {
        // throw away '['
        this.read();
        let result = "";
        while (true) {
            let p = this.peek();
            if (p == ']') {
                this.read();
                break;
            } else if (p == '\\') {
                this.read();
                result += this.read();
            } else if (p == '\0') {
                return {"type": "error", "message": "expected ']'"};
            } else {
                result += this.read(); 
            }
        }
        this.read_whitespace();
        return {"type": "propvalue", "value": result};
    }
}

function test() {
    let data = `(;GM[1]FF[4]CA[UTF-8]AP[CGoban:3]ST[2]
RU[Japanese]SZ[19]KM[6.50]
PW[ alice ]PB[bob ]
(;B[pd]
(;W[qf]
;B[nc]
(;W[qc]
;B[qd]C[comment [some comment\\]])
(;W[qd]
;B[qc]
;W[rc]TR[qd]
;B[qe]
;
;W[rd]
;B[pe]))
(;W[qc]
;B[qd]
;W[pc]TR[qc][pd][qd]
;B[od]LB[pc:D][qc:B][pd:A][qd:C])
(;W[oc]
;B[pc]
;W[mc]))
(;B[qg]))`

    let p = new Parser(data);
    //console.log(p.parse());
    console.dir(p.parse(), {depth: null});
}

test();

