# Drupal procedures for creating the appropriate services endpoint

## Setup / Installation


### OAuth configuration
- Enable the following module (Note the _exact_ name):
    - `OAuth2 Server`
    
- Import the OAuth2 Server server config
    - Structure >> OAuth2 Servers >> Import server
    - Copy and Paste the contents of:
        - `oauth2-server-plugin-configs.txt`
    - Make sure to `Save`

- Add the test client (by hand)
    - Label: `dingo`
    - Client ID: `test`
    - Client secret: `12345`
    - Redirect URIs: `https://dingo.shanti.virginia.edu/oauth2/redirect`  
    - Automatically authorize this client: **checked**

### Services Endpoint
- Make sure to enable these modules:
    - `Services Views`
    - `Rest Server`

- Import the service 
    - Structure >> Services >> Import
    - Copy and Paste the contents of:
        - `ogauth-services-import.txt`
    - Make sure to `Save`

- Import the view
    - Structure >> Views >> Import
    - Copy and Paste the contents of:
        - `ogusergroups-views-import.txt`
    - Make sure to `Save`

