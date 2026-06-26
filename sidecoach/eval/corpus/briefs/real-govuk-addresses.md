# Ask users for
Addresses (real brief, GOV.UK Design System pattern)

source: https://design-system.service.gov.uk/patterns/addresses/

Ask users for
Addresses
This guidance is for government teams that build online services. To find information and services for the public, go to GOV.UK.
Help users provide an address using one of the following:
- Multiple text inputs
- Address lookup
- Textarea
Multiple text inputs
- HTML
- Nunjucks
When to use multiple text inputs
Only use multiple text inputs when you know which countries the addresses will come from and can find a format that supports them all. This can be difficult to know if you’re asking for addresses outside of the UK.
Using multiple text inputs means:
- you can easily extract and use specific parts of an address
- you can give help for individual text inputs
- you can validate each part of the address separately
- users can complete the form using their browser’s autocomplete function
The disadvantages of using multiple text inputs are that:
- it’s hard to find a single format that works for all addresses
- there’s no guarantee that users will use the text inputs the way you think they will
- users cannot easily paste addresses from their clipboards
How multiple text inputs work
If you use multiple text inputs, you should:
- only make individual text inputs mandatory if you really need the information
- make the text inputs the appropriate length for the content – it helps people understand the form, for example, make postcode text inputs shorter than s