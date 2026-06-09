class apiResponse {
  constructor(statusCode, data, message = "Successful") {
    this.statusCode = statusCode;
    this.message = message, this.data = data;
  }
}
export { apiResponse };
