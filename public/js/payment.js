import { db, collection, addDoc, serverTimestamp, doc, updateDoc, onAuthStateChanged, getDocs, auth } from "../firebase.js";

// Retrieve stored data from localStorage
const storedData = JSON.parse(localStorage.getItem('payId'));
const { Title, Description, Amount, Image, Ticket } = storedData;
console.log(Ticket);
let paymentModal = document.getElementById('paymentModal');

// Populate checkout page with product info
document.getElementById('product-title').textContent = Title;
document.getElementById('product-description').textContent = Description;
document.getElementById('product-amount').textContent = Amount;
document.getElementById('product-image').src = Image;

// Initialize Stripe
const stripe = Stripe('pk_test_51PuvL8HG1xPdW1Cj3K1BBZhMzK7I11MAubppNwJ8GdFEmLYlrgoOEOuvPi1XApamKLopBsFMWInllCvxnRIqgtP100Lz9oj4N7');
const elements = stripe.elements();
const cardElement = elements.create('card');
cardElement.mount('#card-element');

// Handle form submission
const form = document.getElementById('payment-form');

const StripeFunction = async (event) => {
    event.preventDefault(); // Form reload hone se rokain

    try {
        // Backend se client secret fetch karen
        const response = await fetch('/api/server', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Title, Description, Amount, Image }),  // Product data backend ko send karen
        });

        if (!response.ok) {
            throw new Error('Failed to fetch client secret');
        }

        const { clientSecret } = await response.json();

        // Stripe ke sath payment confirm karen
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: { card: cardElement },
        });

        if (error) {
            throw new Error(`Payment failed: ${error.message}`);
        } else {
            document.getElementById('payment-result').textContent = 'Payment successful!';
            paymentModal.style.display = 'flex'; // Successful payment ke baad modal show karain
        }
    } catch (err) {
        document.getElementById('payment-result').textContent = `Error: ${err.message}`;
    }
};

form.addEventListener('submit', StripeFunction);



// Modal submit function to validate ticket and answer, and update Firestore

let modalSubmit = document.getElementById('submit-details');
const modalSubmitFuntion = async (event) => {
    event.preventDefault();
    const userTicket = document.getElementById('ticket-number').value;
    const userAnswer = document.getElementById('question-answer').value;
    let UserId = localStorage.getItem('cardId');
    let filterNumber = Ticket.includes(userTicket);
    console.log(filterNumber);

    if (filterNumber && userAnswer) {
        // Show success message
        Toastify({
            text: 'Ticket verified! Withdrawal details will be live soon.',
            duration: 3000,
            gravity: 'top',
            position: 'left',
            style: { background: 'linear-gradient(to right, #00b09b, #96c93d)' }
        }).showToast();

        // Remove ticket from the list
        let ticketArray = Ticket.split(',').map(item => item.trim());
        ticketArray = ticketArray.filter(item => item !== userTicket);
        let updatedTicketString = ticketArray.join(', ');

        // Update Firestore using transaction
        const userDocRef = doc(db, "post", UserId);

        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);

            if (!userDoc.exists()) {
                throw new Error("User document does not exist.");
            }

            // Update tickets in Firestore
            transaction.update(userDocRef, {
                Ticket: updatedTicketString
            });

            console.log("Tickets updated in Firestore.");

            // Continue with user data processing after ticket update
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    const loggedInEmail = user.email;
                    console.log("User is logged in with Email:", loggedInEmail);
                    AllUserDataShow(loggedInEmail, userTicket, userAnswer);

                    setTimeout(() => {
                        window.location.href = "/public/index.html";
                    }, 2000);
                } else {
                    console.log("No user is currently logged in");
                }
            });
        });

    } else {
        // Show error message if ticket or answer is invalid
        Toastify({
            text: 'Invalid ticket number or wrong answer.',
            duration: 3000,
            gravity: 'top',
            position: 'left',
            style: { background: 'linear-gradient(to right, #ff5f6d, #ffc371)' }
        }).showToast();
    }
};

modalSubmit.addEventListener('click', modalSubmitFuntion);

// Function to fetch user data and initiate purchase data addition
const AllUserDataShow = async (loggedInEmail, userTicket, userAnswer) => {
    try {
        const querySnapshot = await getDocs(collection(db, "userData"));
        const matchedUser = querySnapshot.docs.find((doc) => doc.data().email === loggedInEmail);

        if (matchedUser) {
            const userData = matchedUser.data();
            addPurchaseData(userData, userTicket, userAnswer);
        } else {
            console.log("No matching user found with this email.");
        }
    } catch (error) {
        console.log("Error fetching data:", error);
    }
};

// Function to add purchase data to Firestore
const addPurchaseData = async (data, userTicket, userAnswer) => {
    const { Fname, Uname, email, password, phone } = data;

    try {
        const docRef = await addDoc(collection(db, "users"), {
            Fname,
            Uname,
            email,
            password,
            phone,
            Title,
            Description,
            Question,
            Amount,
            Ticket: userTicket,
            Image,
            Answer: userAnswer,
            purchaseTime: serverTimestamp(),
        });
        console.log("Document written with ID: ", docRef.id);
    } catch (e) {
        console.error("Error adding document: ", e);
    }
};
