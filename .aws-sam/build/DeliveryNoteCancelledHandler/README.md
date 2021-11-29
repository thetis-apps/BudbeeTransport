# Introduction

This application enables the printing of shipping labels from the carrier Budbee as an integrated part of your packing process. 

# Installation

You may install the latest version of the application from the Serverless Applicaation Repository. It is registered under the name thetis-ims-budbee-transport.

## Parameters

When installing the application you must provide values for the following parameters:

- ContextId
- ThetisClientId
- ThetisClientSecret
- ApiKey
- DevOpsEmail

A short explanation for each of these parameters are provided upon installation.

## Initialization

Upon installation the application creates a carrier by the name 'Budbee'.

# Configuration

In the data document of the carrier named 'Budbee':
```
{
  "BudbeeTransport": {
    "test": true,
    "apiKey": "d1c1aa0d-60a6-4b1d-9ab3-38066bb6ea51",
    "apiSecret": "8bc90286-15b1-4059-ad86-bda16cf713d74fec3d7e-944d-4c65-ae51-9231591e1e4a",
    "collectionId": 821
  }
}
```

For your convenience the application is initially configured to use our test credentials. You may use this configuration as long as you keep the value of the test attribute to true.

To get your own credentials contact Postnord.

# Events

## Packing completed

When packing of a shipment is completed, the application registers the shipment with Budbee. The shipment is updated with the carriers shipment number.

The shipping containers are updated with the tracking numbers assigned to the corresponding Postnord packages.

Shipping labels are attached to the shipment.




