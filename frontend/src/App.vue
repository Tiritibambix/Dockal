<template>
  <div id="app" class="bg-white min-h-screen">
    <header class="bg-blue-600 text-white p-4">
      <h1 class="text-2xl font-bold">Dockal — Calendar</h1>
    </header>
    <main class="p-4">
      <FullCalendar :options='calendarOptions'/>
      <EventModal
        :isOpen="showEventModal"
        :event="currentEvent"
        @save="saveEvent"
        @delete="deleteEvent"
        @cancel="showEventModal = false"
        @copy="copyEvent"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { ref, onMounted } from 'vue'
import { CalendarEvent } from './types'
import EventModal from './components/EventModal.vue'
import { APIClient } from './api/client'

const calendarOptions = ref({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  },
  editable: true,
  selectable: true,
  selectMirror: true,
  dayMaxEvents: true,
  weekends: true,
  select: handleDateSelect,
  eventClick: handleEventClick,
  events: fetchEvents,
  eventDrop: handleEventDrop,
  eventResize: handleEventResize,
  dateClick: handleDateClick,
  eventContent: renderEventContent,
  eventDataTransform: transformEventData,
  validRange: {
    start: new Date()
  },
  eventLimit: 3,
  eventLimitClick: 'popover',
  eventOverlap: false,
  selectOverlap: false
})

const showEventModal = ref(false)
const currentEvent = ref<CalendarEvent | null>(null)
const apiClient = new APIClient(localStorage.getItem('token') || undefined)

async function fetchEvents(info, successCallback, failureCallback) {
  try {
    const events = await apiClient.getEvents(info.start, info.end)
    successCallback(events)
  } catch (error) {
    failureCallback(error)
  }
}

function handleDateSelect(selectInfo) {
  currentEvent.value = {
    uid: '',
    title: '',
    start: selectInfo.start,
    end: selectInfo.end,
    allDay: selectInfo.allDay,
    timezone: 'UTC'
  }
  showEventModal.value = true
}

function handleEventClick(clickInfo) {
  currentEvent.value = clickInfo.event.extendedProps as CalendarEvent
  showEventModal.value = true
}

async function handleEventDrop(info) {
  const event = info.event.extendedProps as CalendarEvent
  event.start = info.event.start
  event.end = info.event.end
  await saveEvent(event)
}

async function handleEventResize(info) {
  const event = info.event.extendedProps as CalendarEvent
  event.start = info.event.start
  event.end = info.event.end
  await saveEvent(event)
}

async function saveEvent(event: CalendarEvent) {
  if (event.uid) {
    await apiClient.updateEvent(event)
  } else {
    await apiClient.createEvent(event)
  }
}

async function deleteEvent(uid: string) {
  await apiClient.deleteEvent(uid)
}

async function copyEvent(uid: string, dates: Date[]) {
  await apiClient.copyEvent(uid, { dates: dates.map(d => d.toISOString()) })
}

function handleDateClick(arg) {
  currentEvent.value = {
    uid: '',
    title: '',
    start: arg.date,
    end: arg.date,
    allDay: true,
    timezone: 'UTC'
  }
  showEventModal.value = true
}

function renderEventContent(arg) {
  return {
    html: `<div class="fc-event-main-frame">
      <div class="fc-event-title-container">
        <div class="fc-event-title fc-sticky">${arg.event.title}</div>
      </div>
    </div>`
  }
}

function transformEventData(eventData) {
  return {
    ...eventData,
    id: eventData.uid,
    title: eventData.title,
    start: eventData.start,
    end: eventData.end,
    allDay: eventData.allDay,
    extendedProps: eventData
  }
}

onMounted(() => {
  // Additional initialization if needed
})
</script>

<style scoped>
/* ...existing code... */
</style>