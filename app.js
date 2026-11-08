/* v1.1: QR generator bundled with app.js, independent of qr-encode.js loading. */
/* QRCode generator browser bundle. Original code: Kazuhiko Arase, MIT License.
   Adapted from the qrcode-terminal vendored QRCode implementation. See LICENSES.md. */
(function(root){"use strict";
var modules=Object.create(null),cache=Object.create(null);
function req(name){name=name.replace(/^\.\//, "");if(cache[name]) return cache[name].exports;if(!modules[name]) throw new Error("Module missing: "+name);var m={exports:{}};cache[name]=m;modules[name](m,m.exports,req);return m.exports;}
modules["QR8bitByte"]=function(module,exports,require){
var QRMode = require('./QRMode');

function QR8bitByte(data) {
	this.mode = QRMode.MODE_8BIT_BYTE;
	this.data = data;
}

QR8bitByte.prototype = {

	getLength : function() {
		return this.data.length;
	},
	
	write : function(buffer) {
		for (var i = 0; i < this.data.length; i++) {
			// not JIS ...
			buffer.put(this.data.charCodeAt(i), 8);
		}
	}
};

module.exports = QR8bitByte;

};
modules["QRBitBuffer"]=function(module,exports,require){
function QRBitBuffer() {
	this.buffer = [];
	this.length = 0;
}

QRBitBuffer.prototype = {

	get : function(index) {
		var bufIndex = Math.floor(index / 8);
		return ( (this.buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
	},
	
	put : function(num, length) {
		for (var i = 0; i < length; i++) {
			this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
		}
	},
	
	getLengthInBits : function() {
		return this.length;
	},
	
	putBit : function(bit) {
	
		var bufIndex = Math.floor(this.length / 8);
		if (this.buffer.length <= bufIndex) {
			this.buffer.push(0);
		}
	
		if (bit) {
			this.buffer[bufIndex] |= (0x80 >>> (this.length % 8) );
		}
	
		this.length++;
	}
};

module.exports = QRBitBuffer;

};
modules["QRErrorCorrectLevel"]=function(module,exports,require){
module.exports = {
	L : 1,
	M : 0,
	Q : 3,
	H : 2
};


};
modules["QRMaskPattern"]=function(module,exports,require){
module.exports = {
	PATTERN000 : 0,
	PATTERN001 : 1,
	PATTERN010 : 2,
	PATTERN011 : 3,
	PATTERN100 : 4,
	PATTERN101 : 5,
	PATTERN110 : 6,
	PATTERN111 : 7
};

};
modules["QRMath"]=function(module,exports,require){
var QRMath = {

	glog : function(n) {
	
		if (n < 1) {
			throw new Error("glog(" + n + ")");
		}
		
		return QRMath.LOG_TABLE[n];
	},
	
	gexp : function(n) {
	
		while (n < 0) {
			n += 255;
		}
	
		while (n >= 256) {
			n -= 255;
		}
	
		return QRMath.EXP_TABLE[n];
	},
	
	EXP_TABLE : new Array(256),
	
	LOG_TABLE : new Array(256)

};
	
for (var i = 0; i < 8; i++) {
	QRMath.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
	QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
		^ QRMath.EXP_TABLE[i - 5]
		^ QRMath.EXP_TABLE[i - 6]
		^ QRMath.EXP_TABLE[i - 8];
}
for (var i = 0; i < 255; i++) {
	QRMath.LOG_TABLE[QRMath.EXP_TABLE[i] ] = i;
}

module.exports = QRMath;

};
modules["QRMode"]=function(module,exports,require){
module.exports = {
    MODE_NUMBER :       1 << 0,
    MODE_ALPHA_NUM :    1 << 1,
    MODE_8BIT_BYTE :    1 << 2,
    MODE_KANJI :        1 << 3
};

};
modules["QRPolynomial"]=function(module,exports,require){
var QRMath = require('./QRMath');

function QRPolynomial(num, shift) {
	if (num.length === undefined) {
		throw new Error(num.length + "/" + shift);
	}

	var offset = 0;

	while (offset < num.length && num[offset] === 0) {
		offset++;
	}

	this.num = new Array(num.length - offset + shift);
	for (var i = 0; i < num.length - offset; i++) {
		this.num[i] = num[i + offset];
	}
}

QRPolynomial.prototype = {

	get : function(index) {
		return this.num[index];
	},
	
	getLength : function() {
		return this.num.length;
	},
	
	multiply : function(e) {
	
		var num = new Array(this.getLength() + e.getLength() - 1);
	
		for (var i = 0; i < this.getLength(); i++) {
			for (var j = 0; j < e.getLength(); j++) {
				num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i) ) + QRMath.glog(e.get(j) ) );
			}
		}
	
		return new QRPolynomial(num, 0);
	},
	
	mod : function(e) {
	
		if (this.getLength() - e.getLength() < 0) {
			return this;
		}
	
		var ratio = QRMath.glog(this.get(0) ) - QRMath.glog(e.get(0) );
	
		var num = new Array(this.getLength() );
		
		for (var i = 0; i < this.getLength(); i++) {
			num[i] = this.get(i);
		}
		
		for (var x = 0; x < e.getLength(); x++) {
			num[x] ^= QRMath.gexp(QRMath.glog(e.get(x) ) + ratio);
		}
	
		// recursive call
		return new QRPolynomial(num, 0).mod(e);
	}
};

module.exports = QRPolynomial;

};
modules["QRRSBlock"]=function(module,exports,require){
var QRErrorCorrectLevel = require('./QRErrorCorrectLevel');

function QRRSBlock(totalCount, dataCount) {
	this.totalCount = totalCount;
	this.dataCount  = dataCount;
}

QRRSBlock.RS_BLOCK_TABLE = [

	// L
	// M
	// Q
	// H

	// 1
	[1, 26, 19],
	[1, 26, 16],
	[1, 26, 13],
	[1, 26, 9],
	
	// 2
	[1, 44, 34],
	[1, 44, 28],
	[1, 44, 22],
	[1, 44, 16],

	// 3
	[1, 70, 55],
	[1, 70, 44],
	[2, 35, 17],
	[2, 35, 13],

	// 4		
	[1, 100, 80],
	[2, 50, 32],
	[2, 50, 24],
	[4, 25, 9],
	
	// 5
	[1, 134, 108],
	[2, 67, 43],
	[2, 33, 15, 2, 34, 16],
	[2, 33, 11, 2, 34, 12],
	
	// 6
	[2, 86, 68],
	[4, 43, 27],
	[4, 43, 19],
	[4, 43, 15],
	
	// 7		
	[2, 98, 78],
	[4, 49, 31],
	[2, 32, 14, 4, 33, 15],
	[4, 39, 13, 1, 40, 14],
	
	// 8
	[2, 121, 97],
	[2, 60, 38, 2, 61, 39],
	[4, 40, 18, 2, 41, 19],
	[4, 40, 14, 2, 41, 15],
	
	// 9
	[2, 146, 116],
	[3, 58, 36, 2, 59, 37],
	[4, 36, 16, 4, 37, 17],
	[4, 36, 12, 4, 37, 13],
	
	// 10		
	[2, 86, 68, 2, 87, 69],
	[4, 69, 43, 1, 70, 44],
	[6, 43, 19, 2, 44, 20],
	[6, 43, 15, 2, 44, 16],

	// 11
	[4, 101, 81],
	[1, 80, 50, 4, 81, 51],
	[4, 50, 22, 4, 51, 23],
	[3, 36, 12, 8, 37, 13],

	// 12
	[2, 116, 92, 2, 117, 93],
	[6, 58, 36, 2, 59, 37],
	[4, 46, 20, 6, 47, 21],
	[7, 42, 14, 4, 43, 15],

	// 13
	[4, 133, 107],
	[8, 59, 37, 1, 60, 38],
	[8, 44, 20, 4, 45, 21],
	[12, 33, 11, 4, 34, 12],

	// 14
	[3, 145, 115, 1, 146, 116],
	[4, 64, 40, 5, 65, 41],
	[11, 36, 16, 5, 37, 17],
	[11, 36, 12, 5, 37, 13],

	// 15
	[5, 109, 87, 1, 110, 88],
	[5, 65, 41, 5, 66, 42],
	[5, 54, 24, 7, 55, 25],
	[11, 36, 12],

	// 16
	[5, 122, 98, 1, 123, 99],
	[7, 73, 45, 3, 74, 46],
	[15, 43, 19, 2, 44, 20],
	[3, 45, 15, 13, 46, 16],

	// 17
	[1, 135, 107, 5, 136, 108],
	[10, 74, 46, 1, 75, 47],
	[1, 50, 22, 15, 51, 23],
	[2, 42, 14, 17, 43, 15],

	// 18
	[5, 150, 120, 1, 151, 121],
	[9, 69, 43, 4, 70, 44],
	[17, 50, 22, 1, 51, 23],
	[2, 42, 14, 19, 43, 15],

	// 19
	[3, 141, 113, 4, 142, 114],
	[3, 70, 44, 11, 71, 45],
	[17, 47, 21, 4, 48, 22],
	[9, 39, 13, 16, 40, 14],

	// 20
	[3, 135, 107, 5, 136, 108],
	[3, 67, 41, 13, 68, 42],
	[15, 54, 24, 5, 55, 25],
	[15, 43, 15, 10, 44, 16],

	// 21
	[4, 144, 116, 4, 145, 117],
	[17, 68, 42],
	[17, 50, 22, 6, 51, 23],
	[19, 46, 16, 6, 47, 17],

	// 22
	[2, 139, 111, 7, 140, 112],
	[17, 74, 46],
	[7, 54, 24, 16, 55, 25],
	[34, 37, 13],

	// 23
	[4, 151, 121, 5, 152, 122],
	[4, 75, 47, 14, 76, 48],
	[11, 54, 24, 14, 55, 25],
	[16, 45, 15, 14, 46, 16],

	// 24
	[6, 147, 117, 4, 148, 118],
	[6, 73, 45, 14, 74, 46],
	[11, 54, 24, 16, 55, 25],
	[30, 46, 16, 2, 47, 17],

	// 25
	[8, 132, 106, 4, 133, 107],
	[8, 75, 47, 13, 76, 48],
	[7, 54, 24, 22, 55, 25],
	[22, 45, 15, 13, 46, 16],

	// 26
	[10, 142, 114, 2, 143, 115],
	[19, 74, 46, 4, 75, 47],
	[28, 50, 22, 6, 51, 23],
	[33, 46, 16, 4, 47, 17],

	// 27
	[8, 152, 122, 4, 153, 123],
	[22, 73, 45, 3, 74, 46],
	[8, 53, 23, 26, 54, 24],
	[12, 45, 15, 28, 46, 16],

	// 28
	[3, 147, 117, 10, 148, 118],
	[3, 73, 45, 23, 74, 46],
	[4, 54, 24, 31, 55, 25],
	[11, 45, 15, 31, 46, 16],

	// 29
	[7, 146, 116, 7, 147, 117],
	[21, 73, 45, 7, 74, 46],
	[1, 53, 23, 37, 54, 24],
	[19, 45, 15, 26, 46, 16],

	// 30
	[5, 145, 115, 10, 146, 116],
	[19, 75, 47, 10, 76, 48],
	[15, 54, 24, 25, 55, 25],
	[23, 45, 15, 25, 46, 16],

	// 31
	[13, 145, 115, 3, 146, 116],
	[2, 74, 46, 29, 75, 47],
	[42, 54, 24, 1, 55, 25],
	[23, 45, 15, 28, 46, 16],

	// 32
	[17, 145, 115],
	[10, 74, 46, 23, 75, 47],
	[10, 54, 24, 35, 55, 25],
	[19, 45, 15, 35, 46, 16],

	// 33
	[17, 145, 115, 1, 146, 116],
	[14, 74, 46, 21, 75, 47],
	[29, 54, 24, 19, 55, 25],
	[11, 45, 15, 46, 46, 16],

	// 34
	[13, 145, 115, 6, 146, 116],
	[14, 74, 46, 23, 75, 47],
	[44, 54, 24, 7, 55, 25],
	[59, 46, 16, 1, 47, 17],

	// 35
	[12, 151, 121, 7, 152, 122],
	[12, 75, 47, 26, 76, 48],
	[39, 54, 24, 14, 55, 25],
	[22, 45, 15, 41, 46, 16],

	// 36
	[6, 151, 121, 14, 152, 122],
	[6, 75, 47, 34, 76, 48],
	[46, 54, 24, 10, 55, 25],
	[2, 45, 15, 64, 46, 16],

	// 37
	[17, 152, 122, 4, 153, 123],
	[29, 74, 46, 14, 75, 47],
	[49, 54, 24, 10, 55, 25],
	[24, 45, 15, 46, 46, 16],

	// 38
	[4, 152, 122, 18, 153, 123],
	[13, 74, 46, 32, 75, 47],
	[48, 54, 24, 14, 55, 25],
	[42, 45, 15, 32, 46, 16],

	// 39
	[20, 147, 117, 4, 148, 118],
	[40, 75, 47, 7, 76, 48],
	[43, 54, 24, 22, 55, 25],
	[10, 45, 15, 67, 46, 16],

	// 40
	[19, 148, 118, 6, 149, 119],
	[18, 75, 47, 31, 76, 48],
	[34, 54, 24, 34, 55, 25],
	[20, 45, 15, 61, 46, 16]
];

QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
	
	var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
	
	if (rsBlock === undefined) {
		throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
	}

	var length = rsBlock.length / 3;
	
	var list = [];
	
	for (var i = 0; i < length; i++) {

		var count = rsBlock[i * 3 + 0];
		var totalCount = rsBlock[i * 3 + 1];
		var dataCount  = rsBlock[i * 3 + 2];

		for (var j = 0; j < count; j++) {
			list.push(new QRRSBlock(totalCount, dataCount) );	
		}
	}
	
	return list;
};

QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {

	switch(errorCorrectLevel) {
	case QRErrorCorrectLevel.L :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
	case QRErrorCorrectLevel.M :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
	case QRErrorCorrectLevel.Q :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
	case QRErrorCorrectLevel.H :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
	default :
		return undefined;
	}
};

module.exports = QRRSBlock;

};
modules["QRUtil"]=function(module,exports,require){
var QRMode = require('./QRMode');
var QRPolynomial = require('./QRPolynomial');
var QRMath = require('./QRMath');
var QRMaskPattern = require('./QRMaskPattern');

var QRUtil = {

    PATTERN_POSITION_TABLE : [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],        
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
    ],

    G15 : (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18 : (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK : (1 << 14) | (1 << 12) | (1 << 10)    | (1 << 4) | (1 << 1),

    getBCHTypeInfo : function(data) {
        var d = data << 10;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
            d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) ) );    
        }
        return ( (data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber : function(data) {
        var d = data << 12;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
            d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) ) );    
        }
        return (data << 12) | d;
    },

    getBCHDigit : function(data) {

        var digit = 0;

        while (data !== 0) {
            digit++;
            data >>>= 1;
        }

        return digit;
    },

    getPatternPosition : function(typeNumber) {
        return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },

    getMask : function(maskPattern, i, j) {
        
        switch (maskPattern) {
            
        case QRMaskPattern.PATTERN000 : return (i + j) % 2 === 0;
        case QRMaskPattern.PATTERN001 : return i % 2 === 0;
        case QRMaskPattern.PATTERN010 : return j % 3 === 0;
        case QRMaskPattern.PATTERN011 : return (i + j) % 3 === 0;
        case QRMaskPattern.PATTERN100 : return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 === 0;
        case QRMaskPattern.PATTERN101 : return (i * j) % 2 + (i * j) % 3 === 0;
        case QRMaskPattern.PATTERN110 : return ( (i * j) % 2 + (i * j) % 3) % 2 === 0;
        case QRMaskPattern.PATTERN111 : return ( (i * j) % 3 + (i + j) % 2) % 2 === 0;

        default :
            throw new Error("bad maskPattern:" + maskPattern);
        }
    },

    getErrorCorrectPolynomial : function(errorCorrectLength) {

        var a = new QRPolynomial([1], 0);

        for (var i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0) );
        }

        return a;
    },

    getLengthInBits : function(mode, type) {

        if (1 <= type && type < 10) {

            // 1 - 9

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 10;
            case QRMode.MODE_ALPHA_NUM  : return 9;
            case QRMode.MODE_8BIT_BYTE  : return 8;
            case QRMode.MODE_KANJI      : return 8;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 27) {

            // 10 - 26

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 12;
            case QRMode.MODE_ALPHA_NUM  : return 11;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 10;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 41) {

            // 27 - 40

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 14;
            case QRMode.MODE_ALPHA_NUM  : return 13;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 12;
            default :
                throw new Error("mode:" + mode);
            }

        } else {
            throw new Error("type:" + type);
        }
    },

    getLostPoint : function(qrCode) {
        
        var moduleCount = qrCode.getModuleCount();
        var lostPoint = 0;
        var row = 0; 
        var col = 0;

        
        // LEVEL1
        
        for (row = 0; row < moduleCount; row++) {

            for (col = 0; col < moduleCount; col++) {

                var sameCount = 0;
                var dark = qrCode.isDark(row, col);

                for (var r = -1; r <= 1; r++) {

                    if (row + r < 0 || moduleCount <= row + r) {
                        continue;
                    }

                    for (var c = -1; c <= 1; c++) {

                        if (col + c < 0 || moduleCount <= col + c) {
                            continue;
                        }

                        if (r === 0 && c === 0) {
                            continue;
                        }

                        if (dark === qrCode.isDark(row + r, col + c) ) {
                            sameCount++;
                        }
                    }
                }

                if (sameCount > 5) {
                    lostPoint += (3 + sameCount - 5);
                }
            }
        }

        // LEVEL2

        for (row = 0; row < moduleCount - 1; row++) {
            for (col = 0; col < moduleCount - 1; col++) {
                var count = 0;
                if (qrCode.isDark(row,     col    ) ) count++;
                if (qrCode.isDark(row + 1, col    ) ) count++;
                if (qrCode.isDark(row,     col + 1) ) count++;
                if (qrCode.isDark(row + 1, col + 1) ) count++;
                if (count === 0 || count === 4) {
                    lostPoint += 3;
                }
            }
        }

        // LEVEL3

        for (row = 0; row < moduleCount; row++) {
            for (col = 0; col < moduleCount - 6; col++) {
                if (qrCode.isDark(row, col) && 
                        !qrCode.isDark(row, col + 1) && 
                         qrCode.isDark(row, col + 2) && 
                         qrCode.isDark(row, col + 3) && 
                         qrCode.isDark(row, col + 4) && 
                        !qrCode.isDark(row, col + 5) && 
                         qrCode.isDark(row, col + 6) ) {
                    lostPoint += 40;
                }
            }
        }

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount - 6; row++) {
                if (qrCode.isDark(row, col) &&
                        !qrCode.isDark(row + 1, col) &&
                         qrCode.isDark(row + 2, col) &&
                         qrCode.isDark(row + 3, col) &&
                         qrCode.isDark(row + 4, col) &&
                        !qrCode.isDark(row + 5, col) &&
                         qrCode.isDark(row + 6, col) ) {
                    lostPoint += 40;
                }
            }
        }

        // LEVEL4
        
        var darkCount = 0;

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount; row++) {
                if (qrCode.isDark(row, col) ) {
                    darkCount++;
                }
            }
        }
        
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;

        return lostPoint;       
    }

};

module.exports = QRUtil;

};
modules["index"]=function(module,exports,require){
//---------------------------------------------------------------------
// QRCode for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//   http://www.opensource.org/licenses/mit-license.php
//
// The word "QR Code" is registered trademark of 
// DENSO WAVE INCORPORATED
//   http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------
// Modified to work in node for this project (and some refactoring)
//---------------------------------------------------------------------

var QR8bitByte = require('./QR8bitByte');
var QRUtil = require('./QRUtil');
var QRPolynomial = require('./QRPolynomial');
var QRRSBlock = require('./QRRSBlock');
var QRBitBuffer = require('./QRBitBuffer');

function QRCode(typeNumber, errorCorrectLevel) {
	this.typeNumber = typeNumber;
	this.errorCorrectLevel = errorCorrectLevel;
	this.modules = null;
	this.moduleCount = 0;
	this.dataCache = null;
	this.dataList = [];
}

QRCode.prototype = {
	
	addData : function(data) {
		var newData = new QR8bitByte(data);
		this.dataList.push(newData);
		this.dataCache = null;
	},
	
	isDark : function(row, col) {
		if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
			throw new Error(row + "," + col);
		}
		return this.modules[row][col];
	},

	getModuleCount : function() {
		return this.moduleCount;
	},
	
	make : function() {
		// Calculate automatically typeNumber if provided is < 1
		if (this.typeNumber < 1 ){
			var typeNumber = 1;
			for (typeNumber = 1; typeNumber < 40; typeNumber++) {
				var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);

				var buffer = new QRBitBuffer();
				var totalDataCount = 0;
				for (var i = 0; i < rsBlocks.length; i++) {
					totalDataCount += rsBlocks[i].dataCount;
				}

				for (var x = 0; x < this.dataList.length; x++) {
					var data = this.dataList[x];
					buffer.put(data.mode, 4);
					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
					data.write(buffer);
				}
				if (buffer.getLengthInBits() <= totalDataCount * 8)
					break;
			}
			this.typeNumber = typeNumber;
		}
		this.makeImpl(false, this.getBestMaskPattern() );
	},
	
	makeImpl : function(test, maskPattern) {
		
		this.moduleCount = this.typeNumber * 4 + 17;
		this.modules = new Array(this.moduleCount);
		
		for (var row = 0; row < this.moduleCount; row++) {
			
			this.modules[row] = new Array(this.moduleCount);
			
			for (var col = 0; col < this.moduleCount; col++) {
				this.modules[row][col] = null;//(col + row) % 3;
			}
		}
	
		this.setupPositionProbePattern(0, 0);
		this.setupPositionProbePattern(this.moduleCount - 7, 0);
		this.setupPositionProbePattern(0, this.moduleCount - 7);
		this.setupPositionAdjustPattern();
		this.setupTimingPattern();
		this.setupTypeInfo(test, maskPattern);
		
		if (this.typeNumber >= 7) {
			this.setupTypeNumber(test);
		}
	
		if (this.dataCache === null) {
			this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
		}
	
		this.mapData(this.dataCache, maskPattern);
	},

	setupPositionProbePattern : function(row, col)  {
		
		for (var r = -1; r <= 7; r++) {
			
			if (row + r <= -1 || this.moduleCount <= row + r) continue;
			
			for (var c = -1; c <= 7; c++) {
				
				if (col + c <= -1 || this.moduleCount <= col + c) continue;
				
				if ( (0 <= r && r <= 6 && (c === 0 || c === 6) ) || 
                     (0 <= c && c <= 6 && (r === 0 || r === 6) ) || 
                     (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
					this.modules[row + r][col + c] = true;
				} else {
					this.modules[row + r][col + c] = false;
				}
			}		
		}		
	},
	
	getBestMaskPattern : function() {
	
		var minLostPoint = 0;
		var pattern = 0;
	
		for (var i = 0; i < 8; i++) {
			
			this.makeImpl(true, i);
	
			var lostPoint = QRUtil.getLostPoint(this);
	
			if (i === 0 || minLostPoint >  lostPoint) {
				minLostPoint = lostPoint;
				pattern = i;
			}
		}
	
		return pattern;
	},
	
	createMovieClip : function(target_mc, instance_name, depth) {
	
		var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth);
		var cs = 1;
	
		this.make();

		for (var row = 0; row < this.modules.length; row++) {
			
			var y = row * cs;
			
			for (var col = 0; col < this.modules[row].length; col++) {
	
				var x = col * cs;
				var dark = this.modules[row][col];
			
				if (dark) {
					qr_mc.beginFill(0, 100);
					qr_mc.moveTo(x, y);
					qr_mc.lineTo(x + cs, y);
					qr_mc.lineTo(x + cs, y + cs);
					qr_mc.lineTo(x, y + cs);
					qr_mc.endFill();
				}
			}
		}
		
		return qr_mc;
	},

	setupTimingPattern : function() {
		
		for (var r = 8; r < this.moduleCount - 8; r++) {
			if (this.modules[r][6] !== null) {
				continue;
			}
			this.modules[r][6] = (r % 2 === 0);
		}
	
		for (var c = 8; c < this.moduleCount - 8; c++) {
			if (this.modules[6][c] !== null) {
				continue;
			}
			this.modules[6][c] = (c % 2 === 0);
		}
	},
	
	setupPositionAdjustPattern : function() {
	
		var pos = QRUtil.getPatternPosition(this.typeNumber);
		
		for (var i = 0; i < pos.length; i++) {
		
			for (var j = 0; j < pos.length; j++) {
			
				var row = pos[i];
				var col = pos[j];
				
				if (this.modules[row][col] !== null) {
					continue;
				}
				
				for (var r = -2; r <= 2; r++) {
				
					for (var c = -2; c <= 2; c++) {
					
						if (Math.abs(r) === 2 || 
                            Math.abs(c) === 2 ||
                            (r === 0 && c === 0) ) {
							this.modules[row + r][col + c] = true;
						} else {
							this.modules[row + r][col + c] = false;
						}
					}
				}
			}
		}
	},
	
	setupTypeNumber : function(test) {
	
		var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        var mod;
	
		for (var i = 0; i < 18; i++) {
			mod = (!test && ( (bits >> i) & 1) === 1);
			this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
		}
	
		for (var x = 0; x < 18; x++) {
			mod = (!test && ( (bits >> x) & 1) === 1);
			this.modules[x % 3 + this.moduleCount - 8 - 3][Math.floor(x / 3)] = mod;
		}
	},
	
	setupTypeInfo : function(test, maskPattern) {
	
		var data = (this.errorCorrectLevel << 3) | maskPattern;
		var bits = QRUtil.getBCHTypeInfo(data);
        var mod;
	
		// vertical		
		for (var v = 0; v < 15; v++) {
	
			mod = (!test && ( (bits >> v) & 1) === 1);
	
			if (v < 6) {
				this.modules[v][8] = mod;
			} else if (v < 8) {
				this.modules[v + 1][8] = mod;
			} else {
				this.modules[this.moduleCount - 15 + v][8] = mod;
			}
		}
	
		// horizontal
		for (var h = 0; h < 15; h++) {
	
			mod = (!test && ( (bits >> h) & 1) === 1);
			
			if (h < 8) {
				this.modules[8][this.moduleCount - h - 1] = mod;
			} else if (h < 9) {
				this.modules[8][15 - h - 1 + 1] = mod;
			} else {
				this.modules[8][15 - h - 1] = mod;
			}
		}
	
		// fixed module
		this.modules[this.moduleCount - 8][8] = (!test);
	
	},
	
	mapData : function(data, maskPattern) {
		
		var inc = -1;
		var row = this.moduleCount - 1;
		var bitIndex = 7;
		var byteIndex = 0;
		
		for (var col = this.moduleCount - 1; col > 0; col -= 2) {
	
			if (col === 6) col--;
	
			while (true) {
	
				for (var c = 0; c < 2; c++) {
					
					if (this.modules[row][col - c] === null) {
						
						var dark = false;
	
						if (byteIndex < data.length) {
							dark = ( ( (data[byteIndex] >>> bitIndex) & 1) === 1);
						}
	
						var mask = QRUtil.getMask(maskPattern, row, col - c);
	
						if (mask) {
							dark = !dark;
						}
						
						this.modules[row][col - c] = dark;
						bitIndex--;
	
						if (bitIndex === -1) {
							byteIndex++;
							bitIndex = 7;
						}
					}
				}
								
				row += inc;
	
				if (row < 0 || this.moduleCount <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}
		
	}

};

QRCode.PAD0 = 0xEC;
QRCode.PAD1 = 0x11;

QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
	
	var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
	
	var buffer = new QRBitBuffer();
	
	for (var i = 0; i < dataList.length; i++) {
		var data = dataList[i];
		buffer.put(data.mode, 4);
		buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
		data.write(buffer);
	}

	// calc num max data.
	var totalDataCount = 0;
	for (var x = 0; x < rsBlocks.length; x++) {
		totalDataCount += rsBlocks[x].dataCount;
	}

	if (buffer.getLengthInBits() > totalDataCount * 8) {
		throw new Error("code length overflow. (" + 
            buffer.getLengthInBits() + 
            ">" +  
            totalDataCount * 8 + 
            ")");
	}

	// end code
	if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
		buffer.put(0, 4);
	}

	// padding
	while (buffer.getLengthInBits() % 8 !== 0) {
		buffer.putBit(false);
	}

	// padding
	while (true) {
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD0, 8);
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD1, 8);
	}

	return QRCode.createBytes(buffer, rsBlocks);
};

QRCode.createBytes = function(buffer, rsBlocks) {

	var offset = 0;
	
	var maxDcCount = 0;
	var maxEcCount = 0;
	
	var dcdata = new Array(rsBlocks.length);
	var ecdata = new Array(rsBlocks.length);
	
	for (var r = 0; r < rsBlocks.length; r++) {

		var dcCount = rsBlocks[r].dataCount;
		var ecCount = rsBlocks[r].totalCount - dcCount;

		maxDcCount = Math.max(maxDcCount, dcCount);
		maxEcCount = Math.max(maxEcCount, ecCount);
		
		dcdata[r] = new Array(dcCount);
		
		for (var i = 0; i < dcdata[r].length; i++) {
			dcdata[r][i] = 0xff & buffer.buffer[i + offset];
		}
		offset += dcCount;
		
		var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
		var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);

		var modPoly = rawPoly.mod(rsPoly);
		ecdata[r] = new Array(rsPoly.getLength() - 1);
		for (var x = 0; x < ecdata[r].length; x++) {
            var modIndex = x + modPoly.getLength() - ecdata[r].length;
			ecdata[r][x] = (modIndex >= 0)? modPoly.get(modIndex) : 0;
		}

	}
	
	var totalCodeCount = 0;
	for (var y = 0; y < rsBlocks.length; y++) {
		totalCodeCount += rsBlocks[y].totalCount;
	}

	var data = new Array(totalCodeCount);
	var index = 0;

	for (var z = 0; z < maxDcCount; z++) {
		for (var s = 0; s < rsBlocks.length; s++) {
			if (z < dcdata[s].length) {
				data[index++] = dcdata[s][z];
			}
		}
	}

	for (var xx = 0; xx < maxEcCount; xx++) {
		for (var t = 0; t < rsBlocks.length; t++) {
			if (xx < ecdata[t].length) {
				data[index++] = ecdata[t][xx];
			}
		}
	}

	return data;

};

module.exports = QRCode;

};
root.MCQRCode=req("index");root.MCQRCodeLevels=req("QRErrorCorrectLevel");
})(typeof window!=="undefined"?window:self);

/* もちものチェック: local-first app for iOS 16+, no backend */
(() => {
  'use strict';
  const STORAGE_KEY = 'mochimono-check-v1';
  const HISTORY_KEY = 'mochimono-history-v1';
  const OVERRIDES_KEY = 'mochimono-schedule-v1';
  const PIN_KEY = 'mochimono-parent-pin-v1';
  const PREFIX = 'MCHK:';
  const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
  const $ = (id) => document.getElementById(id);
  const SCHOOL_DAYS=[1,2,3,4,5], DAY_NAMES=['日','月','火','水','木','金','土'];
  const CATALOG=[
    ['筆箱','pencil'],['連絡帳','book'],['水筒','bottle'],['宿題ノート','book'],['上履き','shoe',[5]],
    ['体操服','gym'],['給食セット','lunch'],['連絡袋','folder'],['したじき','mat'],['iPad','tablet'],
    ['教科書','book'],['自由帳','book'],['ハンカチ','cloth'],['ティッシュ','tissue'],['ランドセル','bag'],
    ['歯ブラシ','brush'],['なわとび','rope'],['傘','umbrella'],['帽子','cap'],['お弁当','lunchbox'],
    ['絵の具セット','art'],['リコーダー','flute'],['定規','ruler'],['手さげ袋','bag']
  ].map(([name,type,weekdays])=>({name,type,weekdays:weekdays||SCHOOL_DAYS}));
  const TYPE_LABELS={pencil:'筆箱',bottle:'水筒',book:'ノート・本',shoe:'上履き',bag:'かばん',cloth:'ハンカチ',gym:'体操服',lunch:'給食セット',folder:'連絡袋',mat:'したじき',tablet:'タブレット',tissue:'ティッシュ',brush:'歯ブラシ',rope:'なわとび',umbrella:'傘',cap:'帽子',lunchbox:'お弁当',art:'絵の具',flute:'リコーダー',ruler:'定規',letter:'文字キャラ'};
  let storageAvailable = true;
  let items = loadItems();
  let history = loadHistory();
  let scheduleOverrides = loadOverrides();
  let adminUnlocked=false, pendingAdminAction=null, pinMode='unlock', pinAttempts=0, pinLockUntil=0;
  const roamingState=new Map();
  let roamerTimer=0;
  let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedDay = todayKey();
  let activeView = 'home';
  let activeQRItemId = null;
  let cameraStream = null;
  let scanRAF = 0;
  let lastFrameTime = 0;
  let lastSeenQR = '';
  let noQRFrames = 0;
  let toastTimer = 0;
  let cheerItemId = '';
  let selectedFriendId = '';
  const ROOM_LIMIT = 200; // All registered items have a place in the room.
  const captureCanvas = document.createElement('canvas');
  const captureContext = captureCanvas.getContext('2d', {willReadFrequently:true});

  function todayKey(date = new Date()) {
    const p = n => String(n).padStart(2,'0');
    return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}`;
  }
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID().toUpperCase();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128;
    const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
  function normalizeItems(data) {
    if (!data || !Array.isArray(data.items) || data.items.length > 200) throw new Error('データ形式が正しくありません');
    const seen=new Set();
    return data.items.map(i => {
      if (!i || typeof i.name !== 'string' || !i.name.trim() || i.name.length > 35 || typeof i.id !== 'string' || !UUID_RE.test(i.id.toUpperCase())) throw new Error('持ち物データの一部が正しくありません');
      const id=i.id.toUpperCase();
      if (seen.has(id)) throw new Error('同じQR識別子が重複しています');
      seen.add(id);
      const name=i.name.trim();
      const preset=CATALOG.find(x=>x.name===name);
      const type=typeof i.type==='string'&&Object.hasOwn(TYPE_LABELS,i.type)?i.type:(preset?.type||inferLegacyType(name));
      const weekdays=Array.isArray(i.weekdays)?[...new Set(i.weekdays.filter(d=>Number.isInteger(d)&&d>=0&&d<=6))].sort((a,b)=>a-b):[...(preset?.weekdays||SCHOOL_DAYS)];
      return {id,name,checkedOn: typeof i.checkedOn === 'string' && /^\d{4}-\d\d-\d\d$/.test(i.checkedOn) ? i.checkedOn : '',addedOn:typeof i.addedOn==='string'&&/^\d{4}-\d\d-\d\d$/.test(i.addedOn)?i.addedOn:'',type,weekdays};
    });
  }
  function loadItems() {
    try {
      const raw=localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeItems(JSON.parse(raw));
      const sample=CATALOG.slice(0,5).map(c=>({id:uuid(),name:c.name,checkedOn:'',addedOn:todayKey(),type:c.type,weekdays:[...c.weekdays]}));
      localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,items:sample}));
      return sample;
    } catch(err) {
      storageAvailable=false;
      console.error('Storage unavailable:',err);
      return [];
    }
  }
  function normalizeHistory(raw) {
    const out=Object.create(null);
    if(!raw || typeof raw!=='object' || Array.isArray(raw))return out;
    const entries=Object.entries(raw);
    if(entries.length>1000)throw new Error('履歴の日付数が多すぎます');
    for(const [date,day] of entries){
      if(!/^\d{4}-\d\d-\d\d$/.test(date) || !day || !Array.isArray(day.expected) || !Array.isArray(day.checked) || day.expected.length>200 || day.checked.length>200)continue;
      const ids=new Set();const expected=[];
      for(const e of day.expected){
        if(!e || typeof e.id!=='string' || !UUID_RE.test(e.id.toUpperCase()) || typeof e.name!=='string' || !e.name.trim() || e.name.length>35)continue;
        const id=e.id.toUpperCase();if(ids.has(id))continue;ids.add(id);expected.push({id,name:e.name.trim()});
      }
      out[date]={expected,checked:day.checked.map(s=>String(s).toUpperCase()).filter(s=>ids.has(s)),scanned:Array.isArray(day.scanned)?day.scanned.map(s=>String(s).toUpperCase()).filter(s=>ids.has(s)):null,rest:day.rest===true};
    }
    return out;
  }
  function loadHistory(){
    try{const raw=localStorage.getItem(HISTORY_KEY);return raw?normalizeHistory(JSON.parse(raw)):Object.create(null);}
    catch(err){console.warn('History unavailable:',err);return Object.create(null);}
  }
  function loadOverrides(){
    try{
      const raw=localStorage.getItem(OVERRIDES_KEY);if(!raw)return Object.create(null);
      return normalizeOverrides(JSON.parse(raw));
    }catch(err){console.warn('Schedule overrides unavailable',err);return Object.create(null);}
  }
  function normalizeOverrides(value){
    const result=Object.create(null);
    if(!value||typeof value!=='object'||Array.isArray(value))return result;
    const keys=Object.keys(value);if(keys.length>730)throw new Error('日付の設定が多すぎます');
    for(const day of keys){
      if(!/^\d{4}-\d\d-\d\d$/.test(day)||!value[day]||typeof value[day]!=='object')continue;
      const entry=Object.create(null);
      for(const [id,flag] of Object.entries(value[day]))if(UUID_RE.test(id.toUpperCase())&&typeof flag==='boolean')entry[id.toUpperCase()]=flag;
      if(Object.keys(entry).length)result[day]=entry;
    }
    return result;
  }
  function saveOverrides(){
    try{localStorage.setItem(OVERRIDES_KEY,JSON.stringify(scheduleOverrides));return true;}
    catch(err){showToast('日付の設定を保存できなかったよ');return false;}
  }
  function weekdayFor(date){const [y,m,d]=date.split('-').map(Number);return new Date(y,m-1,d).getDay();}
  function isRequiredOn(item,date){
    const v=scheduleOverrides[date]?.[item.id];
    return typeof v==='boolean'?v:item.weekdays.includes(weekdayFor(date));
  }
  function requiredItems(date=todayKey()){return items.filter(i=>isRequiredOn(i,date));}
  function isDateString(date){if(!/^\d{4}-\d\d-\d\d$/.test(date))return false;const [y,m,d]=date.split('-').map(Number);return todayKey(new Date(y,m-1,d))===date;}
  function inferLegacyType(name){
    if(/筆箱|ふでばこ|ペンケース|鉛筆|えんぴつ|ペン/.test(name))return 'pencil';
    if(/水筒|すいとう|ボトル/.test(name))return 'bottle';
    if(/ノート|連絡帳|教科書|ドリル|自由帳|日記|本/.test(name))return 'book';
    if(/上履き|上ばき|うわばき|シューズ|靴/.test(name))return 'shoe';
    if(/袋|バッグ|ランドセル|鞄|ポーチ/.test(name))return 'bag';
    if(/ハンカチ|タオル|布/.test(name))return 'cloth';
    return 'letter';
  }
  function saveHistory(){
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history));return true;}
    catch(err){console.warn('Cannot save history:',err);showToast('履歴を保存できません。空き容量を確認してね。');return false;}
  }
  function syncTodayHistory(){
    const date=todayKey();if(!items.length && !history[date])return;
    const previous=history[date],rest=!!previous?.rest;
    const expected=requiredItems(date),checked=expected.filter(i=>i.checkedOn===date).map(i=>i.id);
    const priorScanned=Array.isArray(previous?.scanned)?previous.scanned:(previous?.checked||[]);
    history[date]={expected:expected.map(i=>({id:i.id,name:i.name})),checked,
      scanned:priorScanned.filter(id=>checked.includes(id)),rest};
    const keys=Object.keys(history).sort();for(const d of keys.slice(0,Math.max(0,keys.length-730)))delete history[d];
    saveHistory();
  }
  function dayData(date){return Object.prototype.hasOwnProperty.call(history,date)?history[date]:null;}
  function isRestDay(date){
    const [year,month,day]=date.split('-').map(Number);
    const weekday=new Date(year,month-1,day).getDay();
    return weekday===0||weekday===6||dayData(date)?.rest===true;
  }
  function toggleRestDay(){
    if(!adminUnlocked){requestAdmin(()=>{toggleRestDay();adminUnlocked=false;});return;}
    const date=selectedDay;if(date>todayKey())return;
    const existing=dayData(date);const rest=!(existing&&existing.rest===true);
    if(!existing)history[date]={expected:[],checked:[],rest};
    else if(!rest && !existing.expected.length)delete history[date];
    else existing.rest=rest;
    saveHistory();renderCalendar();renderFriends();
    showToast(rest?'この日をおやすみにしたよ':'おやすみを解除したよ');
  }

  function renderCalendar(){
    const currentMonth=calendarMonth.getMonth(),year=calendarMonth.getFullYear();
    $('calendarMonthLabel').textContent=`${year}年${currentMonth+1}月`;
    const now=new Date();$('calendarNext').disabled=year>now.getFullYear() || (year===now.getFullYear() && currentMonth>=now.getMonth());
    const first=new Date(year,currentMonth,1),last=new Date(year,currentMonth+1,0).getDate();
    const grid=$('calendarGrid');grid.replaceChildren();
    for(let i=0;i<first.getDay();i++)grid.append(makeText('span','calendar-blank',''));
    for(let d=1;d<=last;d++){
      const date=todayKey(new Date(year,currentMonth,d)),record=dayData(date),count=record?record.checked.length:0,total=record?record.expected.length:0;
      const isRest=!!record?.rest;
      const complete=!!record && !isRest && total>0 && count===total;
      const status=isRest?'rest':record?(total===0?'noitems':complete?'complete':'partial'):'';
      const b=makeText('button','calendar-cell'+(record?' has-record':'')+(status?' '+status:'')+(selectedDay===date?' selected':'')+(date===todayKey()?' today':''),'');
      b.type='button';b.disabled=date>todayKey();b.setAttribute('aria-pressed',selectedDay===date?'true':'false');
      b.setAttribute('aria-label',`${currentMonth+1}月${d}日：${isRest?'おやすみ':record?`${count}/${total}確認済み`:'記録なし'}`);
      b.append(makeText('span','day-number',String(d)),makeText('span','day-note',isRest?'おやすみ':record?(total===0?'対象なし':`${count}/${total}`):'·'));
      b.addEventListener('click',()=>{selectedDay=date;renderCalendar();});grid.append(b);
    }
    const record=dayData(selectedDay), detail=$('calendarDetail');detail.replaceChildren();
    $('calendarRestToggle').textContent=record?.rest?'「おやすみ」を解除する':'この日を「おやすみ」にする';
    $('calendarRestToggle').setAttribute('aria-pressed',record?.rest?'true':'false');
    $('calendarRestToggle').disabled=selectedDay>todayKey();
    const [y,m,d]=selectedDay.split('-').map(Number);detail.append(makeText('h2','',`${m}月${d}日（${'日月火水木金土'[new Date(y,m-1,d).getDay()]}）`));
    if(!record){detail.append(makeText('div','history-empty','この日の記録はないよ。記録はアプリを使った日から残るよ。'));return;}
    if(record.rest){detail.append(makeText('p','rest-detail-label','この日はおやすみ。元気度の集計には入らないよ。'));}
    detail.append(makeText('p','',record.expected.length?`${record.checked.length} / ${record.expected.length} こ確認できたよ`:'この日に必要な持ち物は設定されていないよ。'));
    const columns=makeText('div','history-columns','');const checked=makeText('div','history-col',''),unchecked=makeText('div','history-col unchecked','');
    const checkedIds=new Set(record.checked);
    for(const [col,title,values] of [[checked,'✓ 確認できた',record.expected.filter(i=>checkedIds.has(i.id))],[unchecked,'○ 未確認',record.expected.filter(i=>!checkedIds.has(i.id))]]){
      col.append(makeText('h3','',`${title}（${values.length}）`));
      if(!values.length)col.append(makeText('div','none','なし'));
      else{const ul=document.createElement('ul');for(const v of values)ul.append(makeText('li','',v.name));col.append(ul);}
    }
    columns.append(checked,unchecked);detail.append(columns);
  }
  function changeCalendarMonth(delta){
    calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+delta,1);
    const now=new Date();if(calendarMonth>new Date(now.getFullYear(),now.getMonth(),1))calendarMonth=new Date(now.getFullYear(),now.getMonth(),1);
    const prefix=`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth()+1).padStart(2,'0')}-`;
    const days=Object.keys(history).filter(d=>d.startsWith(prefix)).sort();
    selectedDay=prefix===todayKey().slice(0,8)?todayKey():(days.at(-1)||prefix+'01');
    renderCalendar();
  }
  function saveItems() {
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,items})); return true; }
    catch(err) {storageAvailable=false;showToast('保存できません。端末の空き容量や設定を確認してね。');return false;}
  }
  function showToast(message) {
    const toast=$('toast');toast.textContent=message;toast.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},3300);
  }
  function makeText(tag,cls,text) {
    const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=text;return el;
  }
  function render(){
    const today=todayKey(),needed=requiredItems(today),checked=needed.filter(i=>i.checkedOn===today).length;
    const dt=new Date();$('dateLabel').textContent=`${dt.getMonth()+1}月${dt.getDate()}日（${DAY_NAMES[dt.getDay()]}）のチェック`;
    const total=needed.length,pct=total?Math.round(checked/total*100):0;
    $('progressCount').textContent=`${checked} / ${total}`;
    $('progressFill').style.width=pct+'%';
    $('progressGauge').style.setProperty('--pct',pct+'%');$('progressGauge').setAttribute('aria-valuenow',String(pct));$('gaugePercent').textContent=pct+'%';
    $('scanProgressCount').textContent=`${checked} / ${total}`;$('scanProgressFill').style.width=pct+'%';
    $('progressMessage').textContent=total===0?'今日はチェックする持ち物がないよ':checked===total?'ぜんぶそろったよ！ おつかれさま 🎉':`${total-checked}こ、まだ確認していないよ`;
    $('remainingText').textContent=total===0?'きょうはおやすみ':checked===total?'ぜんぶ確認済み':`のこり ${total-checked}こ`;
    $('manageCount').textContent=`${items.length}こ`;
    renderHomeList(today);renderFriends();
    if(adminUnlocked && activeView==='manage'){renderManageList();renderPlanDate();}
    if(activeView==='calendar')renderCalendar();
  }
  // ===== もちものフレンズのおへや (pure SVG/CSS, lightweight iPhone 8 friendly) =====
  const FRIEND_COLORS={
    pencil:{base:'#ead3bd',detail:'#d1af91'},bottle:{base:'#c6ddd8',detail:'#8dbbb3'},
    book:{base:'#d8d6e9',detail:'#aaa3ce'},shoe:{base:'#f5e6cf',detail:'#cfba95'},
    bag:{base:'#e6c5c6',detail:'#ca969b'},cloth:{base:'#e0e6c9',detail:'#b2c49a'},
    gym:{base:'#f4d7ce',detail:'#cfa99d'},lunch:{base:'#f2e0bb',detail:'#d4b978'},
    folder:{base:'#d8e5d5',detail:'#a4bfa5'},mat:{base:'#cfdce6',detail:'#a4bed1'},
    tablet:{base:'#c9d4db',detail:'#889da8'},tissue:{base:'#e6dbeb',detail:'#b8a5ca'},
    brush:{base:'#e5e7ba',detail:'#b7bb88'},rope:{base:'#d8dbd2',detail:'#9cab99'},
    umbrella:{base:'#d6dbe9',detail:'#9eacd0'},cap:{base:'#f0d4bb',detail:'#cda785'},
    lunchbox:{base:'#e3d4ce',detail:'#c0a69c'},art:{base:'#e2dbe9',detail:'#b6aad1'},
    flute:{base:'#e9dbc8',detail:'#c1ad8e'},ruler:{base:'#dbdec4',detail:'#b0b58b'},
    letter:{base:'#ead4c1',detail:'#b89179'}
  };
  function friendType(item){return TYPE_LABELS[item.type]?item.type:inferLegacyType(item.name);}
  function svgEscape(str){return String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function friendSvg(item,mood){
    const name=item.name,type=friendType(item),color=FRIEND_COLORS[type];
    const stroke='#625b56',base=color.base,detail=color.detail;
    const path=(d,fill=base,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
    const rect=(x,y,w,h,r,fill=base,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
    const line=(d,extra='')=>`<path d="${d}" fill="none" ${extra}/>`;
    let body='',faceY=67,faceX=55;
    if(type==='pencil'){
      body=path('M18 45 Q18 30 35 30 H77 Q94 30 94 46 L92 82 Q92 92 80 92 H30 Q18 92 18 80 Z')
          +line('M20 47 H92',`stroke="${detail}"`)+line('M27 36 H82',`stroke="${detail}"`)
          +rect(68,43,8,11,2,detail)+line('M72 49 v6');faceY=70;
    }else if(type==='bottle'){
      body=rect(38,16,34,14,4,detail)+rect(43,11,24,8,3,base)
          +path('M36 31 Q36 27 42 27 H69 Q75 27 75 34 L74 90 Q73 96 67 96 H42 Q36 96 36 88 Z')
          +rect(38,62,34,15,2,'#eaf0e8',`stroke="${detail}" stroke-width="0.7"`)
          +line('M41 34 H70',`stroke="${detail}"`);faceY=53;
    }else if(type==='book'){
      body=rect(22,20,71,77,3,detail)+rect(18,17,71,77,4)
          +line('M28 20 V91',`stroke="${detail}"`)
          +line('M34 35 H79 M34 43 H76',`stroke="${detail}" stroke-width="0.8"`);
      for(let j=0;j<4;j++)body+=`<circle cx="25" cy="${31+j*15}" r="1.65" fill="#fff" stroke="${stroke}" stroke-width="0.6"/>`;
      faceY=72;
    }else if(type==='shoe'){
      body=path('M19 61 Q25 48 39 47 Q51 47 58 58 L68 65 Q81 71 91 71 Q101 71 101 82 L100 90 Q95 96 83 96 H19 Q13 96 12 88 Q11 80 19 61 Z')
          +line('M21 80 H99',`stroke="${detail}"`)
          +line('M42 56 L51 62 M37 62 L46 69 M32 68 L41 76',`stroke="${detail}"`)
          +line('M16 90 H98',`stroke="${stroke}" stroke-width="1"`);
      faceX=68;faceY=82;
    }else if(type==='bag'){
      body=line('M36 34 V26 Q36 17 46 17 H63 Q73 17 73 26 V34',`stroke="${detail}" stroke-width="3"`)
          +rect(21,32,69,62,10)+rect(29,61,53,26,6,'#f5e9e2',`stroke="${detail}" stroke-width="0.8"`)
          +line('M21 52 H90',`stroke="${detail}"`);faceY=76;
    }else if(type==='cloth'){
      body=rect(20,23,72,72,7)+rect(27,30,58,58,4,'none',`stroke="${detail}" stroke-width="0.8" stroke-dasharray="3 3"`)
          +line('M20 33 Q26 26 31 23',`stroke="${detail}"`);faceY=62;
    }else if(type==='gym'){
      body=path('M34 24 L43 18 H68 L78 24 L99 43 L88 60 L78 54 L78 93 H34 V54 L23 60 L12 43 Z')
        +line('M43 20 Q55 39 68 20 M23 58 L33 49 M78 50 L87 59',`stroke="${detail}"`);faceY=69;
    }else if(type==='lunch'){
      body=path('M28 42 Q18 34 27 28 Q37 23 43 32 Q52 20 59 29 Q68 19 77 29 Q89 34 80 43 L89 82 Q91 94 77 96 H34 Q20 95 22 83 Z')
        +line('M30 44 Q53 53 80 44',`stroke="${detail}"`);faceY=74;
    }else if(type==='folder'){
      body=path('M18 34 H46 L53 23 H91 Q96 23 96 30 V91 Q96 96 89 96 H22 Q17 96 17 90 Z')
        +line('M20 44 H93 M26 53 H85',`stroke="${detail}"`);faceY=74;
    }else if(type==='mat'){
      body=rect(14,25,82,64,5)+rect(20,32,70,49,3,'#eaf3ef',`stroke="${detail}" stroke-width="0.6"`);faceY=64;
    }else if(type==='tablet'){
      body=rect(24,14,65,87,8,detail)+rect(29,20,55,69,4,'#e9f0f0')
        +`<circle cx="56" cy="95" r="2" fill="#fafafa" stroke="${stroke}" stroke-width="0.6"/>`;faceY=67;
    }else if(type==='tissue'){
      body=rect(16,40,80,54,8)+path('M39 42 Q26 30 43 19 Q55 12 59 24 Q76 18 72 35 L66 43 Z','#fff')
        +rect(40,40,32,7,3,detail);faceY=72;
    }else if(type==='brush'){
      body=rect(45,16,20,82,8)+rect(43,10,24,22,4,'#faf9ef')
        +line('M47 11 V24 M53 11 V24 M59 11 V24 M65 11 V24',`stroke="${detail}" stroke-width="2"`);faceY=69;
    }else if(type==='rope'){
      body=`<ellipse cx="55" cy="55" rx="29" ry="34" stroke="${detail}" stroke-width="9" fill="none"/>`
        +rect(16,79,14,24,4)+rect(80,79,14,24,4);faceY=70;
    }else if(type==='umbrella'){
      body=path('M14 51 Q19 10 55 10 Q91 10 97 51 Q86 42 76 52 Q66 42 55 51 Q44 42 34 52 Q24 42 14 51 Z')
        +line('M55 51 V92 Q55 110 70 101',`stroke="${detail}" stroke-width="4"`);faceY=38;
    }else if(type==='cap'){
      body=path('M20 64 Q17 26 56 23 Q93 26 90 64 Q92 74 78 77 H27 Q17 76 20 64 Z')
        +path('M29 76 Q66 90 107 75 Q94 93 64 97 Q39 94 29 76 Z',detail);faceY=61;
    }else if(type==='lunchbox'){
      body=rect(19,39,77,55,11)+rect(22,35,71,11,5,detail)
        +line('M44 36 V33 Q44 28 49 28 H66 Q71 28 71 33 V36',`stroke="${detail}" stroke-width="3"`);faceY=73;
    }else if(type==='art'){
      body=rect(19,35,76,60,9)+rect(23,31,68,10,4,detail)
        +line('M41 32 V28 Q41 23 48 23 H67 Q74 23 74 28 V32',`stroke="${detail}" stroke-width="2"`)
        +`<circle cx="42" cy="48" r="4" fill="#a3c8c7" stroke="none"/><circle cx="55" cy="48" r="4" fill="#dab7ad" stroke="none"/><circle cx="69" cy="48" r="4" fill="#d5c19c" stroke="none"/>`;faceY=76;
    }else if(type==='flute'){
      body=rect(44,12,24,87,6)+line('M45 29 H67',`stroke="${detail}"`);
      for(let i=0;i<4;i++)body+=`<circle cx="56" cy="${43+i*12}" r="2.6" fill="${detail}" stroke="none"/>`;
      faceY=74;faceX=56;
    }else if(type==='ruler'){
      body=rect(31,11,48,94,3)+Array.from({length:8},(_,i)=>line(`M32 ${20+i*10} H${i%2?42:48}`,`stroke="${detail}" stroke-width="1"`)).join('');faceY=78;
    }else{
      // Unknown item: its initial character IS the character, with small eyes and limbs.
      const first=Array.from(name.trim())[0]||'?';
      body=`<text x="55" y="84" text-anchor="middle" font-size="70" font-weight="800" font-family="sans-serif" fill="${base}" stroke="${stroke}" stroke-width="0.7" paint-order="stroke">${svgEscape(first)}</text>`;
      faceY=59;faceX=55;
    }
    const back=mood<35,side=mood>=35&&mood<63;
    let expression='';
    if(back){
      expression=line(`M${faceX-8} ${faceY-6} v15 M${faceX+8} ${faceY-6} v15`,`stroke="${detail}" stroke-width="0.75" stroke-dasharray="2 3"`);
    }else if(side){
      expression=`<circle cx="${faceX+5}" cy="${faceY-4}" r="1.7" fill="${stroke}" stroke="none"/>`
                +line(`M${faceX+7} ${faceY+6} h4`,`stroke="${stroke}" stroke-width="1.25"`);
    }else{
      const smile=mood>78?5:2.5;
      expression=`<circle cx="${faceX-9}" cy="${faceY-4}" r="1.65" fill="${stroke}" stroke="none"/><circle cx="${faceX+9}" cy="${faceY-4}" r="1.65" fill="${stroke}" stroke="none"/>`
                +line(`M${faceX-5} ${faceY+5} Q${faceX} ${faceY+5+smile} ${faceX+5} ${faceY+5}`,`stroke="${stroke}" stroke-width="1.25"`);
    }
    const limbs=line('M19 73 Q11 74 8 83 M91 73 Q98 76 101 83 M42 94 L40 105 M68 94 L70 105',`stroke="${stroke}" stroke-width="1.5"`);
    const accent=back?'friend-back':side?'friend-side':'friend-front';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 114" role="img" aria-hidden="true" class="friend-silhouette ${accent}" fill="none" stroke="${stroke}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">${limbs}${body}${expression}</svg>`;
  }
  function moodStartDate(item){
    if(item.addedOn)return item.addedOn;
    let date=todayKey();
    for(const [day,record] of Object.entries(history)){
      if(record.expected.some(e=>e.id===item.id)&&day<date)date=day;
    }
    return date;
  }
  function friendMood(item){
    // 直近7登校日についての成功率。新規登録直後は中立から始め、1日で急変しない。
    const today=todayKey(),start=moodStartDate(item),end=new Date();
    let opportunities=0,successes=0;
    for(let back=0;back<36 && opportunities<7;back++){
      const day=new Date(end.getFullYear(),end.getMonth(),end.getDate()-back),date=todayKey(day);
      if(date<start)break;
      const record=dayData(date);
      if(record?.rest)continue;
      const required=record?record.expected.some(e=>e.id===item.id):isRequiredOn(item,date);
      if(!required)continue;
      if([0,6].includes(weekdayFor(date))&&!scheduleOverrides[date]?.[item.id])continue;
      // Today is never a missed day until tomorrow.
      const scanned=record?.scanned===null?record?.checked.includes(item.id):record?.scanned?.includes(item.id);
      if(date===today&&!scanned)continue;
      opportunities++;if(scanned)successes++;
    }
    const value=Math.max(8,Math.min(95,Math.round(50+50*(2*successes-opportunities)/(opportunities+2))));
    // 土日のスキャンでも、その場の嬉しい反応を見せる。
    return isRestDay(today)&&dayData(today)?.scanned?.includes(item.id)?Math.min(95,value+17):value;
  }
  function friendPosition(index,count,mood){
    let cols,rows,baseX,baseY;
    if(count===1){baseX=50;baseY=56;}
    else if(count===2){baseX=32+index*36;baseY=56;}
    else if(count===3){baseX=23+index*27;baseY=56;}
    else if(count===4){baseX=17+index*22;baseY=56;}
    else if(count===5){const slots=[[19,34],[50,32],[81,34],[34,74],[69,74]];[baseX,baseY]=slots[index];}
    else{
      cols=count<=6?3:4;rows=Math.ceil(count/cols);
      const col=index%cols,row=Math.floor(index/cols);
      baseX=(col+0.5)*100/cols;baseY=(row+0.5)*100/rows;
    }
    const t=mood/100,nearLeft=baseX<50;
    const x=Math.max(9,Math.min(91,baseX+(nearLeft?-7:7)*(1-t)+ (nearLeft?3:-3)*t));
    const y=Math.max(15,Math.min(89,baseY-7*(1-t)+6*t));
    const scale=(0.74+0.36*t).toFixed(3);
    return {x,y,scale};
  }
  function renderFriends(){
    const stage=$('friendsRoom'),layer=$('friendsLayer');if(!stage||!layer)return;
    layer.replaceChildren();
    if(!items.length){stage.style.height='242px';layer.append(makeText('div','friend-empty','まだ だれも いないよ。もちものを 登録してね。'));$('friendsMiniStatus').textContent='おへやの じゅんび中';return;}
    const members=items.slice(0,ROOM_LIMIT),rows=members.length<=5?2:Math.ceil(members.length/(members.length<=6?3:4));
    roamingState.clear();
    stage.style.height=Math.max(258,rows*124+38)+'px';
    const moods=[];
    for(const [i,item] of members.entries()){
      const mood=friendMood(item),p=friendPosition(i,members.length,mood);moods.push(mood);
      const button=makeText('button','friend-avatar'+(cheerItemId===item.id?' is-celebrating':''),'');
      button.type='button';button.style.left=p.x+'%';button.style.top=p.y+'%';button.style.setProperty('--friend-scale',p.scale);
      button.style.setProperty('--drift',(4+(i%3)*3)+'px');button.style.setProperty('--drift-time',(4.1+(i%5)*0.75)+'s');      button.style.setProperty('--drift-delay',(-i*.73)+'s');
      button.dataset.homeX=String(p.x);button.dataset.homeY=String(p.y);
      button.dataset.mood=String(mood);button.dataset.index=String(i);
      button.style.setProperty('--walk-duration',(4.2-2.3*mood/100).toFixed(2)+'s');
      roamingState.set(item.id,{next:performance.now()+1000+(i%5)*700});
      button.setAttribute('aria-label',item.name+'、'+(mood<35?'向こう向き':mood<63?'横向き':'にこにこ')+'、'+(item.checkedOn===todayKey()?'本日確認済み':'本日未確認'));
      button.dataset.friendId=item.id;
      const motion=makeText('span','friend-motion','');motion.innerHTML=friendSvg(item,mood);
      const name=makeText('span','friend-name',item.name);
      if(item.checkedOn===todayKey()){
        const mark=makeText('span','friend-check','✓');mark.setAttribute('aria-label','今日確認済み');motion.append(mark);
      }
      button.append(makeText('span','friend-shadow',''),motion,name);
      button.addEventListener('click',()=>{
        selectedFriendId=item.id;
        const message=mood<35?'おへやの隅で のんびりしているよ。':mood<63?'少しずつ こちらを向いているよ。':'にこにこして 近くにいるよ！';
        $('friendsMessage').textContent=`${item.name}：${message}${item.checkedOn===todayKey()?' きょうは確認できたね。':' QRで見つけてあげよう。'}`;
        layer.querySelectorAll('.friend-avatar').forEach(el=>el.classList.remove('is-selected'));button.classList.add('is-selected');
      });
      layer.append(button);
    }
    // All items are present; only the number of simultaneous movers is throttled for older iPhones.
    const avg=moods.reduce((a,b)=>a+b,0)/moods.length;
    $('friendsMiniStatus').textContent=avg>=68?'みんな にこにこ':avg>=42?'のんびり しているよ':'ちょっと ひかえめ';
    if(cheerItemId){const i=items.find(t=>t.id===cheerItemId);if(i)$('friendsMessage').textContent=`${i.name}が うれしそう！ みつけてくれて ありがとう。`;cheerItemId='';}
    else if(selectedFriendId){const item=items.find(i=>i.id===selectedFriendId);if(!item){selectedFriendId='';$('friendsMessage').textContent='QRを読み取ると みんなが少しずつ近づいてくるよ。';}}
  }

  function roamFriends(){
    if(activeView!=='home'||document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const now=performance.now(),all=$('friendsLayer').querySelectorAll('.friend-avatar');
    // Throttle the number of active motion transitions on an older device.
    let movers=0;
    for(const avatar of all){
      const id=avatar.dataset.friendId, r=roamingState.get(id);if(!r||r.next>now)continue;
      const mood=Number(avatar.dataset.mood)||50,energy=mood/100;
      const likely=0.18+0.65*energy;
      if(Math.random()<likely && movers<16){
        const homeX=Number(avatar.dataset.homeX),homeY=Number(avatar.dataset.homeY);
        // Low energy: gentle shuffling in the corners. High: lively, wider wandering.
        const radiusX=2+Math.min(13,energy*12),radiusY=1.4+Math.min(10,energy*9);
        const x=Math.max(15,Math.min(85,homeX+(Math.random()*2-1)*radiusX));
        const y=Math.max(19,Math.min(87,homeY+(Math.random()*2-1)*radiusY));
        avatar.style.left=x.toFixed(2)+'%';avatar.style.top=y.toFixed(2)+'%';
        avatar.classList.toggle('is-roaming',energy>0.6);movers++;
      }
      r.next=now+(energy>0.7?1500:energy>0.4?2800:4800)+(Math.random()*1300);
    }
  }
  function renderHomeList(today) {
    const list=$('homeList');list.replaceChildren();
    const needed=requiredItems(today);
    if(!needed.length){list.append(makeText('div','empty-state','今日は必要な持ち物がないよ。保護者の設定から変更できるよ。'));return;}
    for(const item of needed){
      const checked=item.checkedOn===today;
      const b=makeText('button','item-row'+(checked?' is-done':''),'');b.type='button';b.setAttribute('aria-label',`${item.name}：${checked?'確認済み。チェックを外す':'未確認。手動でチェックする'}`);
      const dot=makeText('span','check-icon','✓');dot.setAttribute('aria-hidden','true');
      b.append(dot,makeText('span','item-name',item.name),makeText('span','item-status',checked?'確認済み':'未確認'));
      b.addEventListener('click',()=>{
        item.checkedOn=checked?'':todayKey();saveItems();syncTodayHistory();
        render();showToast(checked?`${item.name} のチェックを外したよ`:`${item.name} を手動でチェックしたよ`);
      });
      list.append(b);
    }
  }
  function makeSmallFriend(item){const el=makeText('span','manage-friend-icon','');el.innerHTML=friendSvg(item,85);return el;}
  function addCatalogItem(entry){
    if(items.length>=200){showToast('登録できるのは200個までだよ');return;}
    if(items.some(i=>i.name===entry.name)){showToast(`「${entry.name}」は登録済みだよ`);return;}
    items.push({id:uuid(),name:entry.name,checkedOn:'',addedOn:todayKey(),type:entry.type,weekdays:[...entry.weekdays]});
    saveItems();syncTodayHistory();render();showToast(`「${entry.name}」を登録したよ`);
  }
  function renderCatalog(){
    const grid=$('catalogGrid');grid.replaceChildren();
    for(const entry of CATALOG){
      const b=makeText('button','catalog-item','');b.type='button';
      const example={name:entry.name,type:entry.type},icon=makeSmallFriend(example);
      b.append(icon,makeText('span','',entry.name));b.addEventListener('click',()=>addCatalogItem(entry));grid.append(b);
    }
  }
  function renderManageList(){
    if(!adminUnlocked)return;
    const list=$('manageList');list.replaceChildren();
    if(!items.length){list.append(makeText('div','empty-state','まだ持ち物がないよ'));return;}
    for(const item of items){
      const row=makeText('div','manage-item','');
      const header=makeText('div','manage-item-head','');
      header.append(makeSmallFriend(item),makeText('strong','manage-name',item.name));
      const typeSelect=makeText('select','type-select','');typeSelect.setAttribute('aria-label',`${item.name}の絵柄`);
      for(const [value,label] of Object.entries(TYPE_LABELS)){const option=document.createElement('option');option.value=value;option.textContent=label;option.selected=value===item.type;typeSelect.append(option);}
      typeSelect.addEventListener('change',()=>{item.type=typeSelect.value;saveItems();render();});
      header.append(typeSelect);row.append(header);
      const weekdays=makeText('div','weekday-control','');weekdays.append(makeText('span','weekday-label','毎週ひつような曜日'));
      const days=makeText('div','weekday-buttons','');
      for(let d=0;d<7;d++){
        const on=item.weekdays.includes(d),b=makeText('button','weekday-chip'+(on?' on':''),DAY_NAMES[d]);
        b.type='button';b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',`${item.name}：${DAY_NAMES[d]}曜日 ${on?'必要':'不要'}`);
        b.addEventListener('click',()=>{
          item.weekdays=on?item.weekdays.filter(x=>x!==d):[...item.weekdays,d].sort((a,b)=>a-b);
          saveItems();syncTodayHistory();render();
        });days.append(b);
      }
      weekdays.append(days);row.append(weekdays);
      const btns=makeText('div','manage-buttons','');
      for(const [label,action,cls] of [['QR','qr',''],['名前変更','rename',''],['削除','delete','danger']]){
        const b=makeText('button','mini-button'+(cls?' '+cls:''),label);b.type='button';
        b.setAttribute('aria-label',`${item.name} の${label}`);b.addEventListener('click',()=>manageAction(action,item.id));btns.append(b);
      }
      row.append(btns);list.append(row);
    }
  }
  function renderPlanDate(){
    if(!adminUnlocked)return;
    const date=$('planDate').value;
    if(!isDateString(date))return;
    const list=$('planList');list.replaceChildren();
    if(!items.length){list.append(makeText('div','field-help','先に持ち物を登録してね。'));return;}
    const day=weekdayFor(date);
    list.append(makeText('p','plan-summary',`${date.replaceAll('-','/')}（${DAY_NAMES[day]}）に必要なもの：${requiredItems(date).length}個`));
    for(const item of items){
      const needed=isRequiredOn(item,date),label=makeText('label','plan-row','');
      const input=document.createElement('input');input.type='checkbox';input.checked=needed;input.setAttribute('aria-label',item.name+'をこの日に必要にする');
      input.addEventListener('change',()=>{
        const baseline=item.weekdays.includes(day);
        if(!scheduleOverrides[date])scheduleOverrides[date]=Object.create(null);
        if(input.checked===baseline)delete scheduleOverrides[date][item.id];else scheduleOverrides[date][item.id]=input.checked;
        if(!Object.keys(scheduleOverrides[date]).length)delete scheduleOverrides[date];
        saveOverrides();if(date===todayKey())syncTodayHistory();render();
      });
      label.append(input,makeText('span','',item.name),makeText('small','',needed?'必要':'不要'));list.append(label);
    }
  }
  function resetPlanDate(){
    const date=$('planDate').value;
    if(!isDateString(date))return;
    delete scheduleOverrides[date];saveOverrides();if(date===todayKey())syncTodayHistory();render();
    showToast('この日を毎週の曜日設定に戻したよ');
  }
  function manageAction(action,id){
    if(!adminUnlocked)return;
    const item=items.find(x=>x.id===id);if(!item)return;
    if(action==='qr'){openQr(item);return;}
    if(action==='rename'){
      const name=window.prompt('持ち物の名前を変更',item.name);
      if(name===null)return;
      const trimmed=name.trim();if(!trimmed||trimmed.length>35){showToast('名前は1〜35文字にしてね');return;}
      item.name=trimmed;saveItems();syncTodayHistory();render();showToast('名前を変更したよ');return;
    }
    if(action==='delete'){
      if(!window.confirm(`「${item.name}」を削除しますか？\nこの持ち物のQRシールは使えなくなります。`))return;
      items=items.filter(x=>x.id!==id);
      for(const day of Object.keys(scheduleOverrides)){
        delete scheduleOverrides[day][id];if(!Object.keys(scheduleOverrides[day]).length)delete scheduleOverrides[day];
      }
      saveItems();saveOverrides();syncTodayHistory();render();showToast('持ち物を削除したよ');
    }
  }
  function switchView(view){
    const names=['home','scanner','calendar','manage'];if(!names.includes(view))return;
    if(view==='manage'&&!adminUnlocked){requestAdmin(()=>switchView('manage'));return;}
    if(activeView==='manage'&&view!=='manage')adminUnlocked=false;
    if(activeView==='scanner' && view!=='scanner')stopScanner();
    activeView=view;
    for(const name of names)$(`${name}View`).hidden=name!==view;
    document.querySelectorAll('[data-view]').forEach(b=>{
      const active=b.dataset.view===view;b.classList.toggle('active',active);
      if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    });
    window.scrollTo(0,0);
    if(view==='scanner')void startScanner(); else render();
  }
  function setScannerMessage(type,message,mark){
    const target=$('scanResult');target.className='scan-result'+(type?' '+type:'');
    $('scanResultText').textContent=message;
    target.querySelector('.result-indicator').textContent=mark||'◎';
  }
  async function startScanner(){
    if(cameraStream)return;
    $('retryCamera').hidden=true;
    $('cameraPlaceholder').hidden=false;
    setScannerMessage('','カメラを準備しているよ…','◎');
    if(!window.isSecureContext){cameraError('カメラにはHTTPSで開く必要があるよ。');return;}
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){cameraError('このブラウザではカメラを利用できないよ。Safariを使ってね。');return;}
    if(typeof window.jsQR!=='function'){cameraError('QR読み取り用の部品を取得できなかったよ。オンラインで一度開き直してね。');return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480}}});
      if(activeView!=='scanner'){stream.getTracks().forEach(t=>t.stop());return;}
      cameraStream=stream;const video=$('cameraVideo');video.srcObject=stream;
      await video.play();$('cameraPlaceholder').hidden=true;
      setScannerMessage('','QRコードを枠の中に入れてね。','◎');
      noQRFrames=0;lastSeenQR='';lastFrameTime=0;scanRAF=requestAnimationFrame(scanFrame);
    }catch(err){
      console.error('Camera error:',err);
      let message='カメラが起動できなかったよ。';
      if(err.name==='NotAllowedError'||err.name==='PermissionDeniedError')message='カメラの使用が許可されていないよ。iPhoneの設定から許可してね。';
      if(err.name==='NotFoundError'||err.name==='OverconstrainedError')message='カメラが見つからないよ。';
      cameraError(message);
    }
  }
  function cameraError(message){$('cameraPlaceholder').hidden=false;$('cameraPlaceholder').lastElementChild.textContent='カメラを起動できません';$('retryCamera').hidden=false;setScannerMessage('error',message,'!');}
  function stopScanner(){
    cancelAnimationFrame(scanRAF);scanRAF=0;
    const video=$('cameraVideo');video.pause();video.srcObject=null;
    if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;
  }
  function scanFrame(t){
    if(!cameraStream || activeView!=='scanner')return;
    scanRAF=requestAnimationFrame(scanFrame);
    if(t-lastFrameTime<220)return;
    lastFrameTime=t;
    const video=$('cameraVideo');if(video.readyState<2||!video.videoWidth||!video.videoHeight)return;
    const w=Math.min(540,video.videoWidth),h=Math.round(w*video.videoHeight/video.videoWidth);
    if(captureCanvas.width!==w||captureCanvas.height!==h){captureCanvas.width=w;captureCanvas.height=h;}
    try{
      captureContext.drawImage(video,0,0,w,h);
      const pixels=captureContext.getImageData(0,0,w,h);
      const result=window.jsQR(pixels.data,w,h,{inversionAttempts:'dontInvert'});
      if(!result){noQRFrames++;if(noQRFrames>4)lastSeenQR='';return;}
      noQRFrames=0;
      const text=result.data.trim();
      if(text===lastSeenQR)return;
      lastSeenQR=text;
      handleScan(text);
    }catch(err){console.error('Decode error:',err);setScannerMessage('error','QRコードの読み取りでエラーが起きたよ。','!');}
  }
  function handleScan(text){
    const v=text.trim().toUpperCase();
    if(!v.startsWith(PREFIX)||!UUID_RE.test(v.slice(PREFIX.length))){setScannerMessage('error','このアプリ用のQRコードではないみたい。','!');return;}
    const item=items.find(x=>x.id===v.slice(PREFIX.length));
    if(!item){setScannerMessage('error','この持ち物は登録されていないよ。バックアップの復元が必要かも。','!');return;}
    if(!isRequiredOn(item,todayKey())){setScannerMessage('duplicate',`「${item.name}」は今日はチェック対象外だよ。`,'○');return;}
    const date=todayKey(),wasScanned=dayData(date)?.scanned?.includes(item.id);
    if(item.checkedOn===date&&wasScanned){setScannerMessage('duplicate',`「${item.name}」はもうQRで確認できているよ。`,'✓');return;}
    item.checkedOn=date;saveItems();syncTodayHistory();
    if(!Array.isArray(history[date].scanned))history[date].scanned=[];
    if(!history[date].scanned.includes(item.id))history[date].scanned.push(item.id);
    saveHistory();cheerItemId=item.id;render();
    setScannerMessage('success',`「${item.name}」をQRで確認できたよ！ 次のQRをどうぞ。`,'✓');
  }
  function qrFor(item){
    if(typeof window.MCQRCode!=='function')throw new Error('QR作成ライブラリがありません');
    const qr=new window.MCQRCode(-1,window.MCQRCodeLevels.M);qr.addData(PREFIX+item.id);qr.make();return qr;
  }
  function drawQR(canvas,item){
    const qr=qrFor(item), count=qr.getModuleCount(),quiet=4;
    const out=canvas.getContext('2d');if(!out)throw new Error('2D描画機能が使用できません');const cell=12;const side=(count+quiet*2)*cell;
    canvas.width=side;canvas.height=side;out.fillStyle='#fff';out.fillRect(0,0,side,side);
    out.fillStyle='#000';for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(qr.isDark(row,col))out.fillRect((col+quiet)*cell,(row+quiet)*cell,cell,cell);
  }
  function openQr(item){
    activeQRItemId=item.id;$('qrModalTitle').textContent=item.name;
    try{drawQR($('qrCanvas'),item);}catch(err){console.error('QR generation error:',err);showToast('QR生成エラー：'+(err?.message||'原因不明'));return;}
    $('qrModal').hidden=false;
  }
  function closeQr(){$('qrModal').hidden=true;activeQRItemId=null;}
  function currentQRItem(){return items.find(i=>i.id===activeQRItemId);}
  function saveQrImage(){
    const item=currentQRItem();if(!item)return;
    const a=document.createElement('a');a.download=`もちものQR_${item.name.replace(/[\\/:*?"<>|]/g,'_')}.png`;a.href=$('qrCanvas').toDataURL('image/png');document.body.append(a);a.click();a.remove();
    showToast('画像のダウンロードを開始したよ');
  }
  function printQRLabels(subset){
    if(!subset.length){showToast('まず持ち物を登録してね');return;}
    const sheet=$('printSheet');sheet.replaceChildren();
    try {
      for(const item of subset){
        const label=makeText('div','print-label','');label.append(makeText('div','print-name',item.name));
        const can=document.createElement('canvas');can.className='print-qr';drawQR(can,item);label.append(can);
        label.append(makeText('div','print-note','もちものチェック用 QR'));sheet.append(label);
      }
    } catch(err) { console.error('QR print error:',err);showToast('QR印刷エラー：'+(err?.message||'原因不明'));return; }
    window.print();
  }
  function downloadBackup(){
    const file=new Blob([JSON.stringify({app:'mochimono-check',version:3,exportedAt:new Date().toISOString(),items,history,scheduleOverrides},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=`もちものバックアップ_${todayKey()}.json`;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
    showToast('バックアップのダウンロードを開始したよ');
  }
  async function importBackup(event){
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>200000)throw new Error('ファイルが大きすぎます');
      const raw=await file.text();const data=JSON.parse(raw);
      if(data.app!=='mochimono-check'||![1,2,3].includes(data.version))throw new Error('このアプリのバックアップではありません');
      const next=normalizeItems(data),nextHistory=data.version>=2?normalizeHistory(data.history):Object.create(null);
      const nextOverrides=data.version>=3?normalizeOverrides(data.scheduleOverrides):Object.create(null);
      const note=data.version===1?'（旧バックアップに履歴は含まれません）':'';
      if(!window.confirm(`バックアップの ${next.length} 個の持ち物と履歴で現在のデータを置き換えますか？${note}`))return;
      items=next;history=nextHistory;scheduleOverrides=nextOverrides;saveItems();saveHistory();saveOverrides();syncTodayHistory();render();showToast('バックアップを復元したよ。QRシールもそのまま使えるよ。');
    }catch(err){showToast(`復元できません：${err.message}`);}finally{event.target.value='';}
  }
  // Parent PIN is an offline convenience lock, not server-enforced authentication.
  function getPinConfig(){
    try{
      const raw=localStorage.getItem(PIN_KEY);if(raw===null)return null;
      const data=JSON.parse(raw);
      if(!data||typeof data.salt!=='string'||!/^[0-9a-f]{32}$/.test(data.salt)||!/^[0-9a-f]{64}$/.test(data.hash))throw new Error('PINの保存情報を確認できません');
      return data;
    }catch(err){throw new Error('PINの情報に問題があります。保護者に確認してください');}
  }
  function hex(bytes){return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
  async function derivePin(pin,salt){
    if(!crypto.subtle)throw new Error('安全な通信（HTTPS）で開いてください');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
    return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/.{2}/g),x=>parseInt(x,16)),iterations:120000,hash:'SHA-256'},key,256)));
  }
  function pinError(message){$('pinError').textContent=message;}
  function showPinModal(mode){
    pinMode=mode;$('pinModal').hidden=false;$('pinInput').value='';$('pinConfirmInput').value='';pinError('');
    const setup=mode!=='unlock';$('pinConfirmRow').hidden=!setup;
    $('pinConfirmInput').required=setup;
    $('pinTitle').textContent=mode==='setup'?'保護者用PINを作る':mode==='change'?'PINを変更する':'保護者用PIN';
    $('pinHint').textContent=mode==='setup'?'最初に4〜8桁の数字を決めてね。次からこの数字で設定を開けるよ。':mode==='change'?'新しいPINを2回入力してね。':'登録した4〜8桁の数字を入力してね。';
    $('pinSubmit').textContent=mode==='unlock'?'ロックを解除':'PINを保存';
    setTimeout(()=>$('pinInput').focus(),80);
  }
  function requestAdmin(action){
    if(adminUnlocked){action();return;}
    pendingAdminAction=action;
    try{showPinModal(getPinConfig()?'unlock':'setup');}
    catch(err){showToast(err.message);pendingAdminAction=null;}
  }
  function closePinModal(){ $('pinModal').hidden=true;pendingAdminAction=null;pinError(''); }
  async function submitPin(event){
    event.preventDefault();const pin=$('pinInput').value,confirm=$('pinConfirmInput').value,button=$('pinSubmit');
    if(!/^\d{4,8}$/.test(pin)){pinError('4〜8桁の数字を入力してね');return;}
    if(Date.now()<pinLockUntil){pinError('続けて間違えたので、少し時間をおいてね');return;}
    button.disabled=true;
    try{
      if(pinMode==='setup'||pinMode==='change'){
        if(pin!==confirm){pinError('確認用のPINと一致しないよ');return;}
        const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
        localStorage.setItem(PIN_KEY,JSON.stringify({salt,hash:await derivePin(pin,salt)}));
      }else{
        const stored=getPinConfig();if(!stored){pinError('PINの設定がありません');return;}
        const proposed=await derivePin(pin,stored.salt);
        let diff=0;for(let i=0;i<proposed.length;i++)diff|=proposed.charCodeAt(i)^stored.hash.charCodeAt(i);
        if(diff!==0){
          pinAttempts++;if(pinAttempts>=5){pinLockUntil=Date.now()+30000;pinAttempts=0;}
          pinError('PINが違うよ'+(pinLockUntil>Date.now()?'。30秒後に試してね':''));$('pinInput').value='';return;
        }
      }
      pinAttempts=0;adminUnlocked=true;$('pinModal').hidden=true;
      const onSuccess=pendingAdminAction;pendingAdminAction=null;
      if(onSuccess)onSuccess();
      if(pinMode==='change')showToast('PINを変更したよ');
      else if(pinMode==='setup')showToast('保護者用PINを設定したよ');
    }catch(err){pinError('PINを保存・確認できません：'+(err?.message||'原因不明'));}
    finally{button.disabled=false;}
  }
  function changePin(){if(!adminUnlocked)return;pendingAdminAction=null;showPinModal('change');}
  function refreshIfDayChanged(){
    const date=todayKey();if(refreshIfDayChanged.last!==date){refreshIfDayChanged.last=date;syncTodayHistory();render();}
  }
  function checkOfflineReadiness(){
    const badge=$('offlineBadge');
    if(!('serviceWorker' in navigator)){badge.textContent='オフライン未対応';badge.className='offline-badge warn';return;}
    navigator.serviceWorker.register('./sw.js').then(reg=>navigator.serviceWorker.ready).then(reg=>{
      if(!reg.active)throw new Error('Service worker inactive');
      const channel=new MessageChannel();
      channel.port1.onmessage=(e)=>{
        if(e.data && e.data.offlineReady){badge.textContent='オフライン準備OK';badge.className='offline-badge ready';}
        else {badge.textContent='ネット接続で準備';badge.className='offline-badge warn';}
      };
      reg.active.postMessage({type:'OFFLINE_STATUS'},[channel.port2]);
    }).catch(err=>{console.warn('Offline setup:',err);badge.textContent='オフライン未準備';badge.className='offline-badge warn';});
  }
  function installEvents(){
    document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
    $('startScanButton').addEventListener('click',()=>switchView('scanner'));
    $('backHome').addEventListener('click',()=>switchView('home'));
    $('calendarPrev').addEventListener('click',()=>changeCalendarMonth(-1));
    $('calendarNext').addEventListener('click',()=>changeCalendarMonth(1));
    $('calendarRestToggle').addEventListener('click',toggleRestDay);
    $('pinForm').addEventListener('submit',event=>{void submitPin(event);});
    $('closePinModal').addEventListener('click',closePinModal);
    $('pinModal').addEventListener('click',e=>{if(e.target===$('pinModal'))closePinModal();});
    $('changePinButton').addEventListener('click',changePin);
    $('planDate').addEventListener('change',renderPlanDate);
    $('planResetButton').addEventListener('click',resetPlanDate);
    $('retryCamera').addEventListener('click',()=>{stopScanner();void startScanner();});
    $('addForm').addEventListener('submit',event=>{
      event.preventDefault();if(items.length>=200){showToast('登録できるのは200個までだよ');return;}
      const input=$('newItemName'),name=input.value.trim();if(!name||name.length>35){showToast('名前は1〜35文字にしてね');return;}
      items.push({id:uuid(),name,checkedOn:'',addedOn:todayKey(),type:'letter',weekdays:[...SCHOOL_DAYS]});saveItems();syncTodayHistory();input.value='';render();showToast(`「${name}」を登録したよ`);
    });
    $('closeQrModal').addEventListener('click',closeQr);
    $('qrModal').addEventListener('click',e=>{if(e.target===$('qrModal'))closeQr();});
    $('saveQrButton').addEventListener('click',saveQrImage);
    $('printSingleButton').addEventListener('click',()=>{const item=currentQRItem();if(item)printQRLabels([item]);});
    $('printAllButton').addEventListener('click',()=>printQRLabels(items));
    $('exportButton').addEventListener('click',downloadBackup);
    $('importButton').addEventListener('click',()=>$('importFile').click());
    $('importFile').addEventListener('change',importBackup);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){stopScanner();adminUnlocked=false;if(activeView==='manage')switchView('home');closePinModal();} else if(activeView==='scanner'){$('retryCamera').hidden=false;setScannerMessage('','「カメラをもう一度起動」を押してね。','◎');}});
    window.addEventListener('pagehide',stopScanner);
    window.addEventListener('pageshow',()=>{render();refreshIfDayChanged.last=todayKey();});
    setInterval(refreshIfDayChanged,60000);
  }
  document.querySelector('.brand-kicker').textContent='もちものフレンズ v1.4';
  $('planDate').value=todayKey();renderCatalog();
  roamerTimer=setInterval(roamFriends,1600);
  syncTodayHistory();installEvents();render();checkOfflineReadiness();
  if(!storageAvailable)showToast('端末内に保存できない状態だよ。Safariの設定を確認してね。');
})();
