async function getZipcodeInfo(zipcode) {
    try {
        // Google Maps Geocoding API endpoint
        const endpoint = `https://maps.googleapis.com/maps/api/geocode/json?address=${zipcode}&key=YOUR_API_KEY`;

        const response = await fetch(endpoint);
        const data = await response.json();

        if (data.status !== 'OK') {
            throw new Error(`Geocoding API error: ${data.status}`);
        }

        const result = data.results[0];
        
        // Extract relevant information
        const info = {
            formattedAddress: result.formatted_address,
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
            placeId: result.place_id,
            types: result.types,
            components: {}
        };

        // Parse address components
        for (const component of result.address_components) {
            for (const type of component.types) {
                info.components[type] = {
                    shortName: component.short_name,
                    longName: component.long_name
                };
            }
        }

        return info;

    } catch (error) {
        console.error('Error getting zipcode information:', error);
        throw error;
    }
}

getZipcodeInfo('10001');
