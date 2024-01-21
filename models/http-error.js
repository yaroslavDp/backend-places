class HttpError extends Error {
    constructor(message, errorCode){
        super(message); //message prop
        this.code = errorCode //errorCode prop
    }
}

module.exports = HttpError;