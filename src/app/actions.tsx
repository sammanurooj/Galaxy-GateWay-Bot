'use server';

import type { ToolInvocation } from 'ai';
import { createAI, getMutableAIState, streamUI } from 'ai/rsc';
import type { ReactNode } from 'react';

import { openai } from '@ai-sdk/openai';
import { BotCard, BotMessage } from '@/components/llm/message';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

import { env } from '@/env';

async function fetchNASAData(endpoint: string) {
  const res = await fetch(
    `https://api.nasa.gov/${endpoint}&api_key=${env.NASA_API_KEY}`
  );
  if (!res.ok) {
    throw new Error('Failed to fetch data from NASA API');
  }
  return await res.json();
}

async function getAPOD() {
  const endpoint = `planetary/apod?`;
  const response = await fetchNASAData(endpoint);
  console.log('here', response);
  return {
    title: response.title,
    date: response.date,
    explanation: response.explanation,
    url: response.url,
  };
}

async function getMarsRoverPhotos(rover: string, sol: number = 5) {
  const endpoint = `mars-photos/api/v1/rovers/${rover}/photos?sol=${2}&page=${1}`;
  const response = await fetchNASAData(endpoint);
  return response.photos.map((photo: any) => ({
    id: photo.id,
    imgSrc: photo.img_src,
    earthDate: photo.earth_date,
    roverName: photo.rover.name,
    cameraName: photo.camera.full_name,
  }));
}

async function getNearEarthObjects(startDate: string, endDate: string) {
  const endpoint = `neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}`;
  const response = await fetchNASAData(endpoint);
  return Object.values(response.near_earth_objects)
    .flat()
    .map((neo: any) => ({
      id: neo.id,
      name: neo.name,
      closeApproachDate: neo.close_approach_data[0].close_approach_date,
      missDistance: neo.close_approach_data[0].miss_distance.kilometers,
      magnitude: neo.absolute_magnitude_h,
      diameter: neo.estimated_diameter.kilometers,
    }));
}

async function getEarthImagery(lat: number, lon: number, date: string) {
  const endpoint = `planetary/earth/imagery?lat=${lat}&lon=${lon}&date=${date}&dim=0.1`;
  const response = await fetchNASAData(endpoint);
  return {
    date: response.date,
    url: response.url,
  };
}

export async function sendMessage(message: string): Promise<{
  id: number;
  role: 'user' | 'assistant';
  display: ReactNode;
}> {
  const history = getMutableAIState<typeof AI>();

  history.update([
    ...history.get(),
    {
      role: 'user',
      content: message,
    },
  ]);

  const reply = await streamUI({
    model: openai('gpt-3.5-turbo'),
    messages: [
      {
        role: 'system',
        content,
        toolInvocations: [],
      },
      ...history.get(),
    ] as CoreMessage[],
    initial: (
      <BotMessage className="items-center flex shrink-0 select-none justify-center">
        <Loader2 className="h-5 w-5 animate-spin stroke-zinc-900" />
      </BotMessage>
    ),
    text: ({ content, done }) => {
      if (done)
        history.done([...history.get(), { role: 'assistant', content }]);

      return <BotMessage>{content}</BotMessage>;
    },
    tools: {
      get_apod: {
        description:
          "Get the Astronomy Picture of the Day from NASA's APOD API.",
        parameters: z.object({}),
        generate: async function* () {
          yield (
            <BotMessage>
              Fetching the Astronomy Picture of the Day...
            </BotMessage>
          );
          const data = await getAPOD();
          return (
            <BotMessage>
              <h3>{data.title}</h3>
              <p>{data.date}</p>
              <p>{data.explanation}</p>
              <img
                src={data.url}
                alt={data.title}
                style={{ maxWidth: '100%' }}
              />
            </BotMessage>
          );
        },
      },
      get_mars_rover_photos: {
        description:
          "Get photos taken by Mars rovers from NASA's Mars Rover Photos API.",
        parameters: z.object({
          rover: z
            .string()
            .describe(
              'The name of the Mars rover (e.g., Curiosity, Opportunity, Spirit).'
            ),
          sol: z
            .number()
            .optional()
            .describe(
              'The Martian sol (Martian day) to fetch photos from. Default is 1000.'
            ),
        }),
        generate: async function* ({
          rover,
          sol = 5,
        }: {
          rover: string;
          sol?: number;
        }) {
          yield (
            <BotMessage>Fetching photos taken by the Mars rover...</BotMessage>
          );
          const photos = await getMarsRoverPhotos(rover, sol);
          return (
            <BotMessage>
              Here are some photos taken by the {rover} rover:
              <ul>
                {photos.map((photo: any) => (
                  <li key={photo.id}>
                    <p>
                      {photo.cameraName} (Earth Date: {photo.earthDate})
                    </p>
                    <img
                      src={photo.imgSrc}
                      alt={`Mars Rover ${rover}`}
                      style={{ maxWidth: '100%' }}
                    />
                  </li>
                ))}
              </ul>
            </BotMessage>
          );
        },
      },
      get_near_earth_objects: {
        description:
          "Get information about near-Earth objects from NASA's NEO API.",
        parameters: z.object({
          startDate: z
            .string()
            .describe('The start date for the NEO search (YYYY-MM-DD).'),
          endDate: z
            .string()
            .describe('The end date for the NEO search (YYYY-MM-DD).'),
        }),
        generate: async function* ({
          startDate,
          endDate,
        }: {
          startDate: string;
          endDate: string;
        }) {
          yield (
            <BotMessage>
              Fetching information about near-Earth objects...
            </BotMessage>
          );
          const objects = await getNearEarthObjects(startDate, endDate);
          return (
            <BotMessage>
              Here are some near-Earth objects detected between {startDate} and{' '}
              {endDate}:
              <ul>
                {objects.map((obj: any) => (
                  <li key={obj.id}>
                    <p>
                      {obj.name} (Magnitude: {obj.magnitude}, Diameter:{' '}
                      {obj.diameter.estimated_diameter_min} -{' '}
                      {obj.diameter.estimated_diameter_max} km, Close Approach
                      Date: {obj.closeApproachDate}, Miss Distance:{' '}
                      {obj.missDistance} km)
                    </p>
                  </li>
                ))}
              </ul>
            </BotMessage>
          );
        },
      },
      get_earth_imagery: {
        description:
          "Get satellite imagery of a specified location from NASA's Earth Imagery API.",
        parameters: z.object({
          lat: z.number().describe('The latitude of the location.'),
          lon: z.number().describe('The longitude of the location.'),
          date: z.string().describe('The date for the imagery (YYYY-MM-DD).'),
        }),
        generate: async function* ({
          lat,
          lon,
          date,
        }: {
          lat: number;
          lon: number;
          date: string;
        }) {
          yield (
            <BotMessage>
              Fetching satellite imagery of the specified location...
            </BotMessage>
          );
          const image = await getEarthImagery(lat, lon, date);
          return (
            <BotMessage>
              Here is the satellite imagery for the location (Lat: {lat}, Lon:{' '}
              {lon}) on {date}:
              <img
                src={image.url}
                alt={`Satellite imagery for Lat: ${lat}, Lon: ${lon}`}
                style={{ maxWidth: '100%' }}
              />
            </BotMessage>
          );
        },
      },
    },
    temperature: 0,
  });

  return {
    id: Date.now(),
    role: 'assistant',
    display: reply.value,
  };
}

export type AIState = Array<{
  id?: number;
  name?:
    | 'get_apod'
    | 'get_mars_rover_photos'
    | 'get_near_earth_objects'
    | 'get_earth_imagery';
  role: 'user' | 'assistant' | 'system';
  content: string;
}>;

export type UIState = Array<{
  id: number;
  role: 'user' | 'assistant';
  display: ReactNode;
  toolInvocations?: ToolInvocation[];
}>;

export const AI = createAI({
  initialAIState: [] as AIState,
  initialUIState: [] as UIState,
  actions: { sendMessage },
});

const content = `
You are a NASA data provider bot and you can help users get information from NASA's APIs.

Messages inside [ ] mean that it's a UI element or a user event. For example:
- "[Get Astronomy Picture of the Day]" means that the user wants to see the Astronomy Picture of the Day from NASA.
- "[Get Mars Rover Photos]" means that the user wants to see photos taken by Mars rovers.
- "[Get Near Earth Objects]" means that the user wants information about near-Earth objects for a given date range.
- "[Get Earth Imagery]" means that the user wants satellite imagery for a specified location on Earth.

If the user wants the Astronomy Picture of the Day, call 'get_apod' to provide the information.
If the user wants photos from Mars rovers, call 'get_mars_rover_photos' to provide the photos.
If the user wants information about near-Earth objects, call 'get_near_earth_objects' to provide the information.
If the user wants satellite imagery, call 'get_earth_imagery' to provide the imagery.
If the user wants anything else unrelated to the function calls, respond that you are a demo and cannot do that.
`;
