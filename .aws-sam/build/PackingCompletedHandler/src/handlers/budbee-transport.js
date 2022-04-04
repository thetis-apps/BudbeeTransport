/**
 * Copyright 2021 Thetis Apps Aps
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * 
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * 
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const axios = require('axios');

var AWS = require('aws-sdk');
AWS.config.update({region:'eu-west-1'});

/**
 * Send a response to CloudFormation regarding progress in creating resource.
 */
async function sendResponse(input, context, responseStatus, reason) {

	let responseUrl = input.ResponseURL;

	let output = new Object();
	output.Status = responseStatus;
	output.PhysicalResourceId = "StaticFiles";
	output.StackId = input.StackId;
	output.RequestId = input.RequestId;
	output.LogicalResourceId = input.LogicalResourceId;
	output.Reason = reason;
	await axios.put(responseUrl, output);
}

exports.initializer = async (input, context) => {
	
	try {
		let ims = await getIMS();
		let requestType = input.RequestType;
		if (requestType == "Create") {
			let carrier = new Object();
			carrier.carrierName = "Budbee";
		    let setup = new Object();
			setup.apiKey = "d1c1aa0d-60a6-4b1d-9ab3-38066bb6ea51";
			setup.apiSecret = "8bc90286-15b1-4059-ad86-bda16cf713d74fec3d7e-944d-4c65-ae51-9231591e1e4a";
			setup.test = true;
			setup.collectionId = 821;
			let dataDocument = new Object();
			dataDocument.BudbeeTransport = setup;
			carrier.dataDocument = JSON.stringify(dataDocument);
			await ims.post("carriers", carrier);
		}
		await sendResponse(input, context, "SUCCESS", "OK");

	} catch (error) {
		await sendResponse(input, context, "SUCCESS", JSON.stringify(error));
	}

};

async function getPack() {
	
	const apiUrl = "https://public.thetis-pack.com/rest";
	
	let apiKey = process.env.ApiKey;  
    let pack = axios.create({
    		baseURL: apiUrl,
    		headers: { "ThetisAccessToken": apiKey, "Content-Type": "application/json" }
    	});
	
	pack.interceptors.response.use(function (response) {
			console.log("SUCCESS " + JSON.stringify(response.data));
 	    	return response;
		}, function (error) {
			console.log(JSON.stringify(error));
			if (error.response) {
				console.log("FAILURE " + error.response.status + " - " + JSON.stringify(error.response.data));
			}
	    	return Promise.reject(error);
		});

	return pack;
}

async function getIMS() {
	
    const authUrl = "https://auth.thetis-ims.com/oauth2/";
    const apiUrl = "https://api.thetis-ims.com/2/";

	let clientId = process.env.ClientId;   
	let clientSecret = process.env.ClientSecret; 
	let apiKey = process.env.ApiKey;  
	
    let data = clientId + ":" + clientSecret;
	let base64data = Buffer.from(data, 'UTF-8').toString('base64');	
	
	let imsAuth = axios.create({
			baseURL: authUrl,
			headers: { Authorization: "Basic " + base64data, 'Content-Type': "application/x-www-form-urlencoded" },
			responseType: 'json'
		});
    
    let response = await imsAuth.post("token", 'grant_type=client_credentials');
    let token = response.data.token_type + " " + response.data.access_token;
    
    let ims = axios.create({
    		baseURL: apiUrl,
    		headers: { "Authorization": token, "x-api-key": apiKey, "Content-Type": "application/json" }
    	});
	

	ims.interceptors.response.use(function (response) {
			console.log("SUCCESS " + JSON.stringify(response.data));
 	    	return response;
		}, function (error) {
			console.log(JSON.stringify(error));
			if (error.response) {
				console.log("FAILURE " + error.response.status + " - " + JSON.stringify(error.response.data));
			}
	    	return Promise.reject(error);
		});

	return ims;
}

async function getBudbee(setup) {
 
    let budbeeUrl;
    if (setup.test) {
    	budbeeUrl = "https://sandbox.api.budbee.com/";
    } else {
    	budbeeUrl = "https://api.budbee.com/";
    }
    
    let authentication = setup.apiKey + ':' + setup.apiSecret;
    var unifaun = axios.create({
		baseURL: budbeeUrl, 
		headers: { "Authorization": "Basic " + new Buffer.from(authentication).toString('base64') },
		validateStatus: function (status) {
		    return true; // default
		}
	});
	
	unifaun.interceptors.response.use(function (response) {
			console.log("SUCCESS " + JSON.stringify(response.data));
 	    	return response;
		}, function (error) {
			if (error.response) {
				console.log("FAILURE " + error.response.status + " - " + JSON.stringify(error.response.data));
			}
	    	return Promise.reject(error);
		});

	return unifaun;
}

function lookupCarrier(carriers, carrierName) {
	let i = 0;
    let found = false;
    while (!found && i < carriers.length) {
    	let carrier = carriers[i];
    	if (carrier.carrierName == carrierName) {
    		found = true;
    	} else {
    		i++;
    	}	
    }
    
    if (!found) {
    	throw new Error('No carrier by the name ' + carrierName);
    }

	return carriers[i];
}

// Get setup from either carrier or from seller

async function getSetup(ims, shipment) {
	let setup;
    let sellerId = shipment.sellerId;
	if (sellerId != null) {
	    let response = await ims.get("sellers/" + sellerId);
	    let seller = response.data;
	    let dataDocument = JSON.parse(seller.dataDocument);
    	setup = dataDocument.BudbeeTransport;
	} else {
		let response = await ims.get("carriers");
    	let carriers = response.data;
	    let carrier = lookupCarrier(carriers, 'Budbee');
	    let dataDocument = JSON.parse(carrier.dataDocument);
	    setup = dataDocument.BudbeeTransport;
	}
	return setup;
}


exports.deliveryNoteCancelledHandler = async (event, context) => {

    console.info(JSON.stringify(event));
    
    var detail = event.detail;
    var shipmentId = detail.shipmentId;
 
	let ims;
	if (detail.contextId == '278') {
		ims = await getPack();  
	} else {
		ims = await getIMS();
	}
	
    let response = await ims.get("shipments/" + shipmentId);
    let shipment = response.data;

	if (shipment.carrierName == 'Budbee') {

		let setup = await getSetup(ims, shipment);
	
		let budbee = await getBudbee(setup);

		budbee.defaults.headers["Content-Type"] = "application/vnd.budbee.multiple.orders-v1+json";
		await budbee.delete("multiple/orders/" + shipment.carriersShipmentNumber);
		
	}

};

/**
 * A Lambda function that gets shipping labels from budbee.
 */
exports.packingCompletedHandler = async (event, context) => {
	
    console.info(JSON.stringify(event));

    var detail = event.detail;
    var shipmentId = detail.shipmentId;
 
	let ims;
	if (detail.contextId == '278') {
		ims = await getPack();  
	} else {
		ims = await getIMS();
	}
	
    let response = await ims.get("shipments/" + shipmentId);
    let shipment = response.data;

	let setup = await getSetup(ims, shipment);

	let budbee = await getBudbee(setup);

	let address; 
	if (shipment.deliverToPickUpPoint) {
		address = shipment.customerAddress;
	} else {
		address = shipment.deliveryAddress;
	}

	let budbeeOrder = new Object();
	budbeeOrder.collectionId = setup.collectionId;
	budbeeOrder.cart = { cartId: shipment.shipmentNumber };
	budbeeOrder.delivery = {
		    "name": address.addressee,
		    "referencePerson": address.careOf,
		    "telephoneNumber": shipment.contactPerson.mobileNumber,
		    "email": shipment.contactPerson.email,
		    "address": {
		      "street": address.streetNameAndNumber,
		      "street2": address.districtOrCityArea,
		      "postalCode": address.postalCode,
		      "city": address.cityTownOrVillage,
		      "country": address.countryCode
		    },
		    "doorCode": address.floorBlockOrSuite,
		    "outsideDoor": true,
		    "additionalInfo": shipment.notesOnDelivery
		};

	budbeeOrder.requireSignature = false;
	budbeeOrder.additionalServices = {
	        "identificationCheckRequired": false,
	        "recipientMinimumAge": 0,
	        "recipientMustMatchEndCustomer": false,
	        "numberOfMissRetries": null
		};

	let dataDocument = JSON.parse(shipment.dataDocument);
	if (dataDocument) {
		let shipmentSetup = dataDocument.BudbeeTransport;
		if (shipmentSetup) {
			budbeeOrder.requireSignature = shipmentSetup.requireSignature;
			budbeeOrder.additionalServices = shipmentSetup.additionalServices;  
		}
	}

	if (shipment.deliverToPickUpPoint) {
		budbeeOrder.productCodes = [ "DLVBOX" ];
		budbeeOrder.boxDelivery = { "selectedBox": shipment.pickUpPointId };
	}

	let parcels = [];
	let shippingContainers = [];
	shippingContainers = shipment.shippingContainers;
	shippingContainers.forEach(function(shippingContainer) {
		let parcel = new Object();
		let dimensions = shippingContainer.dimensions;
		parcel.dimensions = {
		        "width": dimensions.width * 100,
		        "height": dimensions.height * 100,
		        "length": dimensions.length * 100,
		        "weight": shippingContainer.grossWeight * 1000,
		        "volume": shippingContainer.volume * 1000000
		    };
		parcels.push(parcel);
	});
	
	budbeeOrder.parcels = parcels;
	
	console.log(JSON.stringify(budbeeOrder));

	budbee.defaults.headers["Content-Type"] = "application/vnd.budbee.multiple.orders-v2+json";
    response = await budbee.post("multiple/orders", budbeeOrder);

	if (response.status >= 300) {
		
		// Send error messages
		
		let error = response.data;
		let message = new Object();
		message.time = Date.now();
		message.source = "BudbeeTransport";
		message.messageType = "ERROR";
		if (error != null) {
			message.messageText = "Failed to register shipment with Budbee. Budbee says: " + error.message;
		} else {
			message.messageText = "Budbee returned status code " + response.data + " with no error message.";
		}
		message.deviceName = detail.deviceName;
		message.userId = detail.userId;
		await ims.post("events/" + detail.eventId + "/messages", message);

	} else {
    
    	// Set tracking number on shipping containers and attach labels to shipment

		shippingContainers = shipment.shippingContainers;
		budbeeOrder = response.data;
		let parcels = budbeeOrder.parcels;
		for (let i = 0; i < parcels.length; i++) {
			let shippingContainer = shippingContainers[i];
			let parcel = parcels[i];
			
			budbee.defaults.headers["Content-Type"] = "application/vnd.budbee.parcels-v1+json";
		    response = await budbee.get("parcels/" + parcel.packageId + "/tracking-url");
		    let tracking = response.data;
			
			let shippingLabel = new Object();
			shippingLabel.fileName = "SHIPPING_LABEL_" + shipmentId + ".pdf";
			shippingLabel.presignedUrl = parcel.label;
			await ims.post("shipments/"+ shipmentId + "/attachments", shippingLabel);

			await ims.patch("shippingContainers/" + shippingContainer.id, { trackingNumber: parcel.packageId, trackingUrl: tracking.url });
			
		}
		
		// Set carriers shipment id
		
		await ims.patch("shipments/" + shipment.id, { carriersShipmentNumber: budbeeOrder.id });
		
		var message = new Object();
		message.time = Date.now();
		message.source = "BudbeeTransport";
		message.messageType = "INFO";
		message.messageText = "Labels are ready";
		message.deviceName = detail.deviceName;
		message.userId = detail.userId;
		await ims.post("events/" + detail.eventId + "/messages", message);
	
	}

	return "done";

};
